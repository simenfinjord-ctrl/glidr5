// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage, parseGroupScopes } from "./storage";
import { parsePermissions, hashPassword, verifyPassword } from "./auth";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { sendPasswordResetEmail, sendWelcomeEmail, sendInvitationEmail, sendInterestNotification } from "./email";
import { generateTotpSecret, getTotpUri, generateQrDataUrl, generateBackupCodes, verifyTotp, verifyBackupCode } from "./totp";
import { r2Enabled, uploadToR2, getR2Url } from "./r2";

/** Shared password validation: ≥7 chars, ≥1 digit, ≥1 special character */
export function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[0-9]/.test(pw)) return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must contain at least one special character.";
  return null;
}

async function checkTeamLimit(teamId: number, resource: "users" | "groups" | "tests" | "products"): Promise<{ allowed: boolean; limit: number | null; current: number }> {
  const { pool } = await import("./db");
  const teamRes = await (pool as any).query(`SELECT max_users, max_groups, max_tests, max_products FROM teams WHERE id = $1`, [teamId]);
  const team = teamRes.rows[0];
  if (!team) return { allowed: true, limit: null, current: 0 };
  const colMap = { users: "max_users", groups: "max_groups", tests: "max_tests", products: "max_products" } as const;
  const tableMap = { users: "users", groups: "groups", tests: "tests", products: "products" } as const;
  const limit: number | null = team[colMap[resource]] ?? null;
  if (limit === null) return { allowed: true, limit: null, current: 0 };
  const countRes = await (pool as any).query(`SELECT COUNT(*) as cnt FROM ${tableMap[resource]} WHERE team_id = $1`, [teamId]);
  const current = parseInt(countRes.rows[0]?.cnt || "0");
  return { allowed: current < limit, limit, current };
}
import { type PermissionArea, type PermissionLevel, PERMISSION_AREAS, DEFAULT_PERMISSIONS, CURRENT_TERMS_VERSION, runsheetProgress, watchSessions, watchQueue, teams, tests, testEntries, users, testSkiSeries, products, dailyWeather, raceSkis } from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, sql, inArray } from "drizzle-orm";
async function enforceTeamAreas(perms: Record<string, string>, teamId: number | undefined): Promise<Record<string, string>> {
  if (!teamId) return perms;
  const team = await storage.getTeam(teamId);
  if (!team || !team.enabledAreas) return perms;
  try {
    const enabled: string[] = JSON.parse(team.enabledAreas as string);
    const result = { ...perms };
    for (const area of PERMISSION_AREAS) {
      // raceprepGlide is a sub-permission of raceprep — enabled whenever raceprep is,
      // so existing teams don't need an enabledAreas migration.
      const enablingArea = area === "raceprepGlide" ? "raceprep" : area;
      if (!enabled.includes(enablingArea)) {
        result[area] = "none";
      }
    }
    return result;
  } catch {
    return perms;
  }
}

// Time tests are ranked on the AVERAGE across every run — the stored primary
// rank (rank_0km) must say the same as the test view, or the winners on the
// Tests list and in analytics would silently be round-1 winners.
function applyAvgRanks(entries: any[]): void {
  const avgOf = (e: any): number | null => {
    let vals: number[] = [];
    try {
      const parsed = e.results ? JSON.parse(e.results) : null;
      if (Array.isArray(parsed)) vals = parsed.map((r: any) => r?.result).filter((v: any) => v != null && !isNaN(Number(v))).map(Number);
    } catch {}
    if (vals.length === 0 && e.result0kmCmBehind != null) vals = [Number(e.result0kmCmBehind)];
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const withAvg = entries.map((e) => ({ e, avg: avgOf(e) }));
  const ranked = withAvg.filter((x) => x.avg != null).sort((a, b) => a.avg! - b.avg!);
  let prev: number | null = null, rank = 0;
  ranked.forEach((x, i) => {
    if (prev == null || x.avg! > prev) rank = i + 1;
    prev = x.avg!;
    x.e.rank0km = rank;
  });
  withAvg.filter((x) => x.avg == null).forEach((x) => { x.e.rank0km = null; });
}

// Access to a race ski: athlete skis follow athlete access; team fleet skis
// (athleteId null) are open to any raceskis-level user on the owning team.
async function canTouchRaceSki(ski: any, req: Request, u: { id: number; isScopeAdmin: boolean }): Promise<boolean> {
  if (ski.athleteId == null) return ski.teamId === getActiveTeamId(req);
  return storage.hasAthleteAccess(ski.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
}

// Whether the team's plan includes a given feature key (e.g. "time_tests").
async function teamHasFeature(teamId: number | undefined, feature: string): Promise<boolean> {
  if (!teamId) return false;
  try {
    const team = await storage.getTeam(teamId);
    return !!team?.enabledAreas && JSON.parse(team.enabledAreas as string).includes(feature);
  } catch { return false; }
}

// A Team Admin administers the team, so they hold edit rights everywhere the
// team actually has — anything less and they cannot do the job they were just
// given. Areas the team has not bought stay "none".
async function teamAdminPermissions(teamId: number | undefined): Promise<Record<string, string>> {
  const all: Record<string, string> = {};
  for (const area of PERMISSION_AREAS) all[area] = "edit";
  return await enforceTeamAreas(all, teamId);
}

function sanitizePermissions(input: any): Record<string, string> {
  const result: Record<string, string> = { ...DEFAULT_PERMISSIONS };
  if (!input) return result;
  const raw = typeof input === "string" ? (() => { try { return JSON.parse(input); } catch { return {}; } })() : input;
  if (typeof raw !== "object" || raw === null) return result;
  for (const area of PERMISSION_AREAS) {
    const val = raw[area];
    if (val === "none" || val === "edit") {
      result[area] = val;
    } else if (val === "view") {
      result[area] = "edit";
    }
  }
  return result;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function isIncognito(req: Request): boolean {
  return !!(req.session as any)?.incognito || !!(req.session as any)?.stealth;
}

function isStealth(req: Request): boolean {
  return !!(req.session as any)?.stealth;
}

function isStealthViewingOtherTeam(req: Request): boolean {
  if (!req.user || req.user.isAdmin !== 1) return false;
  if (!isStealth(req)) return false;
  const activeTeamId = (req.user as any).activeTeamId || req.user.teamId;
  return activeTeamId !== req.user.teamId;
}

function enforceStealthReadOnly(req: Request, res: Response, next: NextFunction) {
  if (isStealthViewingOtherTeam(req)) {
    const method = req.method.toUpperCase();
    if (method === "PUT" || method === "PATCH" || method === "DELETE") {
      const url = req.originalUrl || req.url;
      const allowedPaths = ["/api/auth/stealth", "/api/auth/incognito", "/api/auth/logout", "/api/teams/switch"];
      if (allowedPaths.some(p => url.startsWith(p))) {
        return next();
      }
      return res.status(403).json({ message: "Read-only access in stealth mode" });
    }
    if (method === "POST") {
      const url = req.originalUrl || req.url;
      const safePostPaths = [
        "/api/auth/stealth", "/api/auth/incognito", "/api/auth/logout",
        "/api/teams/switch",
      ];
      if (safePostPaths.some(p => url.startsWith(p))) {
        return next();
      }
      return res.status(403).json({ message: "Read-only access in stealth mode" });
    }
  }
  next();
}

// ── Per-team access resolution ───────────────────────────────────────────────
// A user shared into another team gets their permissions, group scope and
// team-admin flag from user_team_permissions. These land in the session, but
// they must NEVER go stale: an admin who grants rights (or TA status) while the
// user is logged in would otherwise see no effect until the user switched teams
// again or logged out. refreshPerTeamAccess() re-resolves them whenever the
// active team changes or the cached copy is older than REFRESH_MS.
const PER_TEAM_REFRESH_MS = 20_000;

/** A blank per-team group scope means "every group in this team", not "the
 *  group whose name is the empty string" — which matched nothing and left
 *  shared users staring at empty pages. */
async function expandBlankScope(teamId: number): Promise<string> {
  try {
    const { pool: pS } = await import("./db");
    const r = await (pS as any).query(`SELECT name FROM groups WHERE team_id = $1`, [teamId]);
    const names = r.rows.map((x: any) => String(x.name ?? "").trim()).filter(Boolean);
    // Include the literal "All" bucket that records can carry even when no
    // group by that name exists.
    if (!names.some((n: string) => n.toLowerCase() === "all")) names.push("All");
    return names.join(",");
  } catch {
    return "All";
  }
}

async function refreshPerTeamAccess(req: Request): Promise<void> {
  const u = req.user as any;
  if (!u || u.isAdmin === 1) return; // SA needs no per-team resolution
  const activeTid = u.activeTeamId ?? u.teamId;
  const sess = req.session as any;
  const fresh = sess.perTeamResolvedAt && Date.now() - sess.perTeamResolvedAt < PER_TEAM_REFRESH_MS;
  if (sess.perTeamResolvedFor === activeTid && fresh) return;

  // Home team: global permissions and scope apply.
  if (activeTid === u.teamId) {
    sess.effectivePermissions = null;
    sess.effectiveGroupScope = null;
    sess.activeTeamIsAdmin = false;
    sess.perTeamResolvedFor = activeTid;
    sess.perTeamResolvedAt = Date.now();
    return;
  }

  // Parent-team TAs administer their child teams — full access, no group limit.
  try {
    const { pool: pR } = await import("./db");
    const tRes = await (pR as any).query(`SELECT parent_team_id FROM teams WHERE id = $1`, [activeTid]);
    if (u.isTeamAdmin === 1 && tRes.rows[0]?.parent_team_id === u.teamId) {
      sess.effectivePermissions = null;
      sess.effectiveGroupScope = "";
      sess.activeTeamIsAdmin = true;
      sess.perTeamResolvedFor = activeTid;
      sess.perTeamResolvedAt = Date.now();
      return;
    }
    const tpRes = await (pR as any).query(
      "SELECT permissions, group_scope, is_team_admin FROM user_team_permissions WHERE user_id = $1 AND team_id = $2",
      [u.id, activeTid]
    );
    if (tpRes.rows.length > 0) {
      const row = tpRes.rows[0];
      sess.effectivePermissions = row.permissions ?? null;
      sess.activeTeamIsAdmin = row.is_team_admin === 1;
      const scope = String(row.group_scope ?? "").trim();
      sess.effectiveGroupScope = scope || (row.is_team_admin === 1 ? "" : await expandBlankScope(activeTid));
    } else {
      // Member of the team without an explicit per-team row: keep their own
      // permissions, and let them see every group in the team.
      sess.effectivePermissions = null;
      sess.activeTeamIsAdmin = false;
      sess.effectiveGroupScope = await expandBlankScope(activeTid);
    }
    sess.perTeamResolvedFor = activeTid;
    sess.perTeamResolvedAt = Date.now();
  } catch (e) {
    console.error("[per-team-access] refresh failed:", e);
  }
}

// Who last touched a record, and when. "Who changed this?" is the most common
// disagreement on a team with several waxers, and created_by only answers who
// started it. The table name is always a literal from our own code, never input.
const EDIT_STAMPED = new Set(["tests", "products", "test_ski_series", "race_skis", "daily_weather"]);
async function stampEdit(table: string, id: number | null | undefined, req: Request): Promise<void> {
  if (!id || !EDIT_STAMPED.has(table)) return;
  try {
    const u = req.user;
    if (!u) return;
    const { pool: pgE } = await import("./db");
    await (pgE as any).query(
      `UPDATE ${table} SET updated_at = $1, updated_by_id = $2, updated_by_name = $3 WHERE id = $4`,
      [new Date().toISOString(), u.id, u.name, id]);
  } catch (e) { console.error(`[stampEdit] ${table} failed:`, e); }
}

function getEffectivePermissionsStr(req: Request): string {
  // Per-team permissions override global permissions when viewing a non-primary team
  const sessionPerms = (req.session as any)?.effectivePermissions;
  return sessionPerms ?? req.user!.permissions;
}

function getEffectiveGroupScope(req: Request): string {
  // Per-team group scope overrides global group scope when viewing a non-primary team
  const sessionScope = (req.session as any)?.effectiveGroupScope;
  if (sessionScope !== undefined && sessionScope !== null) return sessionScope;
  return req.user!.groupScope;
}

// Whether the user is a team admin OF THE ACTIVE TEAM. A user who is TA on their
// home team is only a regular member on other teams unless explicitly made TA
// there — so they must NOT inherit admin rights (or "see all athletes") on a
// team where they were merely added as a member.
function getEffectiveIsTeamAdmin(req: Request): boolean {
  const u = req.user!;
  if (u.isAdmin === 1) return true; // Super Admin manages every team
  const activeTid = (u as any).activeTeamId ?? u.teamId;
  if (activeTid === u.teamId) return u.isTeamAdmin === 1; // home team
  return !!(req.session as any)?.activeTeamIsAdmin; // other team → per-team flag
}

function userInfo(req: Request) {
  const u = req.user!;
  const effTeamAdmin = getEffectiveIsTeamAdmin(req);
  const perms = parsePermissions(getEffectivePermissionsStr(req), u.isAdmin === 1, effTeamAdmin);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    groupScope: getEffectiveGroupScope(req),
    isAdmin: u.isAdmin === 1,
    isTeamAdmin: effTeamAdmin,
    isScopeAdmin: u.isAdmin === 1 || effTeamAdmin,
    teamId: u.teamId,
    activeTeamId: getActiveTeamId(req),
    permissions: perms,
  };
}

// ── Parent/child team sharing ────────────────────────────────────────────────
// A child team reads the parent's data in the shared areas. Everything shared
// is strictly read-only and marked sharedFromTeam; the parent can hide whole
// tests, single ski pairs or products via child_visibility_exclusions — hidden
// pairs are removed and ranks/results recomputed so the child sees a complete,
// consistent test.

async function getParentShare(teamId: number | null | undefined): Promise<{ parentTeamId: number; parentName: string; sharedAreas: string[] } | null> {
  if (!teamId) return null;
  const { pool } = await import("./db");
  const r = await (pool as any).query(
    `SELECT t.parent_team_id AS pid, p.name FROM teams t JOIN teams p ON p.id = t.parent_team_id WHERE t.id = $1`, [teamId]);
  if (!r.rows.length || !r.rows[0].pid) return null;
  const s = await (pool as any).query(`SELECT shared_areas FROM teams WHERE id = $1`, [teamId]);
  let areas: string[] = [];
  try { areas = JSON.parse(s.rows[0]?.shared_areas || "[]"); } catch { /* none */ }
  return { parentTeamId: r.rows[0].pid, parentName: r.rows[0].name, sharedAreas: areas };
}

async function getChildExclusions(parentTeamId: number): Promise<{ tests: Set<number>; entries: Set<number>; products: Set<number> }> {
  const { pool } = await import("./db");
  const r = await (pool as any).query(
    `SELECT entity_type, entity_id FROM child_visibility_exclusions WHERE parent_team_id = $1`, [parentTeamId]);
  const out = { tests: new Set<number>(), entries: new Set<number>(), products: new Set<number>() };
  for (const row of r.rows) {
    if (row.entity_type === "test") out.tests.add(row.entity_id);
    else if (row.entity_type === "test_entry") out.entries.add(row.entity_id);
    else if (row.entity_type === "product") out.products.add(row.entity_id);
  }
  return out;
}

/** Does the active team have child teams (is it a parent)? */
async function listChildTeams(teamId: number): Promise<{ id: number; name: string }[]> {
  const { pool } = await import("./db");
  const r = await (pool as any).query(`SELECT id, name FROM teams WHERE parent_team_id = $1`, [teamId]);
  return r.rows;
}

// Recompute per-round cm-behind and ranks for the remaining (visible) entries:
// new best pair becomes the 0-point, everything re-ranked per round. Feeling
// and kick ranks are renumbered compactly in their existing order.
function recomputeSharedEntries(entries: any[]): any[] {
  const parseResults = (e: any): { result: number | null; rank: number | null }[] => {
    try { const a = JSON.parse(e.results || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
  };
  const parsed = entries.map((e) => ({ e, rounds: parseResults(e) }));
  const maxRounds = Math.max(0, ...parsed.map((p) => p.rounds.length));
  for (let r = 0; r < maxRounds; r++) {
    const inRound = parsed.filter((p) => p.rounds[r] && p.rounds[r].result != null && !isNaN(Number(p.rounds[r].result)));
    if (inRound.length === 0) continue;
    const best = Math.min(...inRound.map((p) => Number(p.rounds[r].result)));
    const order = [...inRound].sort((a, b) => Number(a.rounds[r].result) - Number(b.rounds[r].result));
    order.forEach((p, i) => {
      p.rounds[r] = { ...p.rounds[r], result: Math.round((Number(p.rounds[r].result) - best) * 100) / 100, rank: i + 1 };
    });
  }
  const renumber = (key: string) => {
    const ranked = parsed.filter((p) => p.e[key] != null).sort((a, b) => a.e[key] - b.e[key]);
    ranked.forEach((p, i) => { p.e = { ...p.e, [key]: i + 1 }; });
  };
  renumber("feelingRank");
  renumber("kickRank");
  return parsed.map((p) => ({
    ...p.e,
    results: JSON.stringify(p.rounds),
    result0kmCmBehind: p.rounds[0]?.result ?? null,
    rank0km: p.rounds[0]?.rank ?? null,
  }));
}

// ── Mix serial numbers ───────────────────────────────────────────────────────
// 3-digit ids per TEAM, shared across kick and glide mixes:
//   001–300 powders · 301–399 liquids · 400–600 solid gliders ·
//   601–699 other · 700–999 kick waxes
const MIX_SERIAL_RANGES: Record<string, [number, number]> = {
  powder: [1, 300], liquid: [301, 399], solid: [400, 600], other: [601, 699], kick: [700, 999],
};
const MIX_KIND_CATEGORY: Record<string, string> = {
  powder: "Paraffin", liquid: "Liquid", solid: "Block", other: "Block", kick: "Kick",
};
async function nextMixSerial(teamId: number, kind: string): Promise<string | null> {
  const [lo, hi] = MIX_SERIAL_RANGES[kind] ?? MIX_SERIAL_RANGES.other;
  const { pool: pSer } = await import("./db");
  const r = await (pSer as any).query(
    `SELECT serial_number FROM products WHERE team_id = $1 AND serial_number IS NOT NULL`, [teamId]);
  const used = new Set(r.rows.map((x: any) => parseInt(x.serial_number)).filter((n: number) => !isNaN(n)));
  for (let n = lo; n <= hi; n++) if (!used.has(n)) return String(n).padStart(3, "0");
  return null;
}

function requirePermission(area: PermissionArea, level: PermissionLevel) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const u = req.user!;
    if (u.isAdmin !== 1) {
      const effectiveTeamId = getActiveTeamId(req);
      if (effectiveTeamId) {
        try {
          const team = await storage.getTeam(effectiveTeamId);
          if (team?.enabledAreas) {
            const enabled: string[] = JSON.parse(team.enabledAreas);
            // Child teams: areas shared from the parent count as enabled — the
            // child must be able to OPEN e.g. Kick to see the shared data even
            // when the area isn't part of their own plan.
            try {
              const sa: string[] = JSON.parse((team as any).sharedAreas || "[]");
              for (const a of sa) if (!enabled.includes(a)) enabled.push(a);
            } catch { /* no shared areas */ }
            if (!enabled.includes(area)) {
              return res.status(403).json({ message: "This area is not enabled for your team" });
            }
          }
        } catch {}
      }
    }
    // TA status must be resolved against the ACTIVE team — being TA at home
    // grants nothing on a team where the user is just a member.
    const perms = parsePermissions(getEffectivePermissionsStr(req), u.isAdmin === 1, getEffectiveIsTeamAdmin(req));
    const userLevel = perms[area];
    if (userLevel === "none") {
      return res.status(403).json({ message: "No access" });
    }
    next();
  };
}

// May the caller VIEW this test (already verified to be in their team)?
// Mirrors GET /api/tests/:id: tests permission + group scope, with the
// creator and race-ski athlete access as fallbacks.
async function canViewTestRecord(test: any, req: Request): Promise<boolean> {
  const u = userInfo(req);
  if (test.createdById === u.id) return true;
  if (u.permissions.tests !== "none" && userHasGroupAccess(u.groupScope, u.isScopeAdmin, test.groupScope || "")) return true;
  if (test.testSkiSource === "raceskis" && test.athleteId) {
    return await storage.hasAthleteAccess(test.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
  }
  return false;
}

function isEffectiveAdmin(req: Request): boolean {
  const u = req.user!;
  return u.isAdmin === 1 || getEffectiveIsTeamAdmin(req);
}

function userHasGroupAccess(userGroupScope: string, isAdmin: boolean, recordGroupScope: string): boolean {
  if (isAdmin) return true;
  const userGroups = parseGroupScopes(userGroupScope);
  return userGroups.includes(recordGroupScope);
}

function verifyTeamOwnership(record: any, req: Request): boolean {
  if (!record) return true;
  const u = req.user!;
  if (u.isAdmin === 1) return true;
  // A record whose teamId column is explicitly NULL belongs to no team and is
  // denied for non-SA (legacy safety net — team columns are NOT NULL today).
  // `undefined` means the record type simply has no teamId field; those checks
  // are handled elsewhere, so we don't block them here.
  if (record.teamId === null) return false;
  if (record.teamId === undefined) return true;
  const teamId = getActiveTeamId(req);
  return record.teamId === teamId;
}

// Returns the tests visible to a user within ONE team, given that team's
// resolved permissions/group scope. Mirrors the visibility rules of GET
// /api/tests and is used by the cross-team combined view.
async function collectTeamVisibleTests(opts: {
  teamId: number;
  perms: any;
  groupScope: string;
  isScopeAdmin: boolean;
  isAthleteAccess: boolean;
  linkedAthleteId: number | null;
  athleteIds: number[];
}): Promise<any[]> {
  const { teamId, perms, groupScope, isScopeAdmin, isAthleteAccess, linkedAthleteId, athleteIds } = opts;
  let result: any[] = [];
  const seen = new Set<number>();
  if (isScopeAdmin) {
    const all = await storage.listAllTestsForTeam(teamId);
    for (const t of all) { result.push(t); seen.add(t.id); }
  } else if (isAthleteAccess) {
    if (linkedAthleteId) {
      const all = await storage.listAllTestsForTeam(teamId);
      for (const t of all) {
        if (!seen.has(t.id) && (t as any).testSkiSource === "raceskis" && (t as any).athleteId === linkedAthleteId) {
          result.push(t); seen.add(t.id);
        }
      }
    }
  } else {
    if (perms.tests !== "none") {
      const scoped = await storage.listTests(groupScope, false, teamId);
      for (const t of scoped) {
        if (!seen.has(t.id) && (t as any).testSkiSource !== "raceskis") { result.push(t); seen.add(t.id); }
      }
    }
    if (perms.raceskis !== "none" && athleteIds.length > 0) {
      const all = await storage.listAllTestsForTeam(teamId);
      for (const t of all) {
        if (!seen.has(t.id) && (t as any).testSkiSource === "raceskis" &&
            (t as any).athleteId && athleteIds.includes((t as any).athleteId)) {
          result.push(t); seen.add(t.id);
        }
      }
    }
    if (perms.grinding === "none") result = result.filter((t: any) => t.testType !== "Grind");
  }
  return result;
}

// Distance/round labels for a test (mirrors the client getDistanceLabels).
function srvDistanceLabels(t: any): string[] {
  if (t.distanceLabels) {
    try { const p = JSON.parse(t.distanceLabels); if (Array.isArray(p) && p.length > 0) return p; } catch {}
  }
  const labels: string[] = [t.distanceLabel0km || "0 km"];
  if (t.distanceLabelXkm) labels.push(t.distanceLabelXkm);
  return labels;
}
// Per-round {result, rank} for an entry (mirrors the client getEntryRounds).
function srvEntryRounds(e: any, numRounds: number): { result: number | null; rank: number | null }[] {
  if (e.results) {
    try {
      const parsed = JSON.parse(e.results);
      if (Array.isArray(parsed)) {
        while (parsed.length < numRounds) parsed.push({ result: null, rank: null });
        return parsed.slice(0, numRounds);
      }
    } catch {}
  }
  const r: { result: number | null; rank: number | null }[] = [
    { result: e.result_0km_cm_behind ?? null, rank: e.rank_0km ?? null },
  ];
  if (numRounds > 1) r.push({ result: e.result_xkm_cm_behind ?? null, rank: e.rank_xkm ?? null });
  while (r.length < numRounds) r.push({ result: null, rank: null });
  return r;
}

// Chain-of-custody: record a deletion with a JSON snapshot of the affected
// record. ALWAYS logs — never skipped by incognito — so if data disappears you
// can see exactly what was removed, by whom, and when.
async function recordDeletion(req: Request, entityType: string, entityId: number | null, label: string, snapshot: any): Promise<void> {
  try {
    const u = userInfo(req);
    let snap: string | null = null;
    try { snap = snapshot != null ? JSON.stringify(snapshot) : null; } catch { snap = null; }
    if (snap && snap.length > 40000) snap = snap.slice(0, 40000) + "…";
    await storage.createActivityLog({
      userId: u.id, userName: u.name, action: "deleted",
      entityType, entityId: entityId ?? 0,
      details: label, snapshot: snap,
      createdAt: new Date().toISOString(),
      groupScope: u.groupScope, teamId: getActiveTeamId(req),
    } as any);
  } catch (e) { console.error("[audit] recordDeletion failed:", e); }
}

// Change-audit: record an EDIT with a before/after snapshot of only the fields
// that actually changed. ALWAYS logs — never skipped by incognito — so admins
// can see exactly who changed what, and what the value was before.
async function recordChange(req: Request, entityType: string, entityId: number | null, label: string, before: any, after: any): Promise<void> {
  try {
    if (!before || !after) return;
    const changedBefore: Record<string, unknown> = {};
    const changedAfter: Record<string, unknown> = {};
    const keys = new Set<string>([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    keys.delete("password");
    for (const k of keys) {
      const b = (before as any)[k];
      const a = (after as any)[k];
      let same = false;
      try { same = JSON.stringify(b ?? null) === JSON.stringify(a ?? null); } catch { same = b === a; }
      if (!same) { changedBefore[k] = b ?? null; changedAfter[k] = a ?? null; }
    }
    const changedKeys = Object.keys(changedAfter);
    if (changedKeys.length === 0) return; // nothing actually changed
    let snap: string | null = null;
    try { snap = JSON.stringify({ before: changedBefore, after: changedAfter }); } catch { snap = null; }
    if (snap && snap.length > 40000) snap = snap.slice(0, 40000) + "…";
    const u = userInfo(req);
    await storage.createActivityLog({
      userId: u.id, userName: u.name, action: "updated",
      entityType, entityId: entityId ?? 0,
      details: `${label} — ${changedKeys.join(", ")}`, snapshot: snap,
      createdAt: new Date().toISOString(),
      groupScope: u.groupScope, teamId: getActiveTeamId(req),
    } as any);
  } catch (e) { console.error("[audit] recordChange failed:", e); }
}

function resolveCreateGroupScope(req: Request): string {
  const u = req.user!;
  const isAdminOrTeamAdmin = u.isAdmin === 1 || u.isTeamAdmin === 1;
  const requestedGroup = req.body.groupScope?.trim();

  if (requestedGroup) {
    if (isAdminOrTeamAdmin) return requestedGroup;
    const userGroups = parseGroupScopes(u.groupScope);
    if (userGroups.includes(requestedGroup)) return requestedGroup;
  }

  return parseGroupScopes(u.groupScope)[0] || u.groupScope;
}

function getActiveTeamId(req: Request): number {
  const u = req.user!;
  // Respect activeTeamId for ALL users — the team-switch route already validates
  // that a user belongs to the target team before setting activeTeamId.
  return (u as any).activeTeamId || u.teamId;
}

function canManageTeam(req: Request): boolean {
  const u = req.user!;
  if (u.isAdmin === 1) return true;
  const activeTeamId = (u as any).activeTeamId || u.teamId;
  // On the user's own (primary) team, the global team-admin flag applies. On any
  // OTHER team, admin rights come only from that team's per-team admin flag —
  // being TA of one team must NOT grant admin on the others.
  if (activeTeamId === u.teamId) return u.isTeamAdmin === 1;
  return !!(req.session as any)?.activeTeamIsAdmin;
}

function getAdminTeamScope(req: Request): number | undefined {
  const u = req.user!;
  if (u.isAdmin !== 1) return getActiveTeamId(req);
  const scope = req.query.teamScope as string | undefined;
  if (scope === "all") return undefined;
  if (scope && !isNaN(parseInt(scope))) return parseInt(scope);
  return getActiveTeamId(req);
}

// ─── Maintenance mode (Super Admin only to toggle) ───────────────────────────
let maintenanceMode = false;
let maintenanceReopenAt: string | null = null; // ISO datetime string
// ─────────────────────────────────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {

  app.use("/api", enforceStealthReadOnly);

  // --- Ensure watch tables exist (migration-safe, runs before any route uses them) ---
  {
    const { pool } = await import("./db");
    await (pool as any).query(`
      CREATE TABLE IF NOT EXISTS watch_sessions (
        code VARCHAR(4) PRIMARY KEY,
        ski_pairs TEXT NOT NULL DEFAULT '[]',
        ski_labels TEXT,
        bracket TEXT NOT NULL DEFAULT '[]',
        test_id INTEGER,
        user_id INTEGER NOT NULL DEFAULT 0,
        user_name TEXT NOT NULL DEFAULT '',
        team_id INTEGER,
        created_at TEXT NOT NULL DEFAULT '',
        expires_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS watch_queue (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        test_id INTEGER,
        series_id INTEGER,
        test_name TEXT,
        series_name TEXT,
        added_by_name TEXT NOT NULL DEFAULT '',
        added_at TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        completed_at TEXT,
        session_code TEXT
      );
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS watch_pin TEXT;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS length TEXT;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS type_of_ski TEXT;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS where_received TEXT;
      ALTER TABLE race_skis ALTER COLUMN athlete_id DROP NOT NULL;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS team_id INTEGER;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS is_sitski INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS is_training_ski INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS default_ski_brand TEXT;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS archived INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS sport_class TEXT;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS main_waxer_id INTEGER;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS main_waxer_name TEXT;
      -- The creating waxer is the main waxer until a TA assigns someone else.
      UPDATE athletes SET main_waxer_id = created_by_id, main_waxer_name = created_by_name WHERE main_waxer_id IS NULL;
      -- Super Admin accounts are never team members: they access every team by
      -- role alone, leaving only the access-transparency log behind. Strip any
      -- membership/share rows that may exist for them (idempotent).
      DELETE FROM user_teams WHERE user_id IN (SELECT id FROM users WHERE is_admin = 1);
      DELETE FROM user_team_permissions WHERE user_id IN (SELECT id FROM users WHERE is_admin = 1);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_all_teams INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_tester INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_version TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS last_backup_error TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS last_backup_error_at TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS discount_percent REAL NOT NULL DEFAULT 0;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS last_backup_rows INTEGER;
      -- Mixes are real products: 3-digit serial per team, recipe stored on the
      -- product so history/analytics work like any other product.
      ALTER TABLE products ADD COLUMN IF NOT EXISTS serial_number TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_mix INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe TEXT;
      ALTER TABLE kick_mixes ADD COLUMN IF NOT EXISTS product_id INTEGER;
      -- Parent/child teams: a child team is fully independent but gets READ
      -- access to the parent's data in the areas listed in shared_areas.
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS parent_team_id INTEGER;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS shared_areas TEXT;
      CREATE TABLE IF NOT EXISTS child_visibility_exclusions (
        id SERIAL PRIMARY KEY,
        parent_team_id INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        created_at TEXT,
        created_by_name TEXT
      );
      ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
      ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS device_id TEXT;
      ALTER TABLE test_entries ADD COLUMN IF NOT EXISTS feeling_note TEXT;
      ALTER TABLE test_entries ADD COLUMN IF NOT EXISTS kick_solution TEXT;
      ALTER TABLE test_ski_series ADD COLUMN IF NOT EXISTS action_status TEXT;
      ALTER TABLE test_ski_series ADD COLUMN IF NOT EXISTS action_location TEXT;
      ALTER TABLE grind_profiles ADD COLUMN IF NOT EXISTS is_us_grind INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS no_weather INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS feedback_sheet_url TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS feedback_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE ski_race_usages ADD COLUMN IF NOT EXISTS athlete_rating TEXT;
      ALTER TABLE ski_race_usages ADD COLUMN IF NOT EXISTS athlete_comment TEXT;
      ALTER TABLE race_prep_entries ADD COLUMN IF NOT EXISTS athlete_rating TEXT;
      ALTER TABLE race_prep_entries ADD COLUMN IF NOT EXISTS athlete_comment TEXT;
      ALTER TABLE race_prep_entries ADD COLUMN IF NOT EXISTS borrowed_athlete_id INTEGER;
      ALTER TABLE race_prep_entries ADD COLUMN IF NOT EXISTS borrowed_athlete_id_classic INTEGER;
      ALTER TABLE race_prep_entries ADD COLUMN IF NOT EXISTS borrowed_athlete_id_skating INTEGER;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS product_sheet_url TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS product_sheet_group TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS order_quantity INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS order_placed INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS product_orders (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        brand TEXT NOT NULL,
        items TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'ordered',
        ordered_at TEXT,
        ordered_by_id INTEGER,
        ordered_by_name TEXT,
        delivered_at TEXT,
        delivered_by_id INTEGER,
        delivered_by_name TEXT
      );
      CREATE INDEX IF NOT EXISTS product_orders_team_idx ON product_orders(team_id);
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS last_product_sync_at TEXT;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS height_cm TEXT;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS weight_kg TEXT;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS pole_height TEXT;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS pole_height_skate TEXT;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS binding_position TEXT;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS ski_service_preferences TEXT;
      ALTER TABLE athlete_access ADD COLUMN IF NOT EXISTS can_edit INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS kick_skis (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        group_scope TEXT,
        name TEXT,
        brand TEXT,
        grind TEXT,
        heights TEXT,
        type_of_ski TEXT,
        color TEXT,
        notes TEXT,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        created_by_id INTEGER NOT NULL,
        created_by_name TEXT NOT NULL
      );
      ALTER TABLE kick_skis ADD COLUMN IF NOT EXISTS color TEXT;
      CREATE TABLE IF NOT EXISTS kick_tests (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        group_scope TEXT,
        date TEXT NOT NULL,
        location TEXT,
        weather_id INTEGER,
        no_weather INTEGER NOT NULL DEFAULT 0,
        test_persons TEXT,
        notes TEXT,
        report TEXT,
        created_at TEXT NOT NULL,
        created_by_id INTEGER NOT NULL,
        created_by_name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS kick_test_entries (
        id SERIAL PRIMARY KEY,
        kick_test_id INTEGER NOT NULL,
        kick_ski_id INTEGER NOT NULL,
        binder TEXT,
        kick_solution TEXT,
        feeling_rank INTEGER,
        feeling_notes TEXT
      );
      CREATE TABLE IF NOT EXISTS kick_mixes (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        group_scope TEXT,
        name TEXT NOT NULL,
        mix_type TEXT NOT NULL DEFAULT 'hardwax',
        roller_temperature TEXT,
        products TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        created_by_id INTEGER NOT NULL,
        created_by_name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS feedback_links (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        athlete_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        created_by_id INTEGER,
        created_by_name TEXT NOT NULL DEFAULT '',
        revoked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS ski_race_usages (
        id SERIAL PRIMARY KEY,
        ski_id INTEGER NOT NULL,
        athlete_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        location TEXT,
        discipline TEXT,
        weather_id INTEGER,
        manual_weather TEXT,
        result TEXT,
        notes TEXT,
        created_by_id INTEGER,
        created_by_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT ''
      );
      ALTER TABLE watch_sessions ADD COLUMN IF NOT EXISTS ski_labels TEXT;
      ALTER TABLE watch_queue ADD COLUMN IF NOT EXISTS session_code TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_watch INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS watch_code TEXT;
      CREATE TABLE IF NOT EXISTS user_team_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        permissions TEXT NOT NULL
      );
      ALTER TABLE user_team_permissions ADD COLUMN IF NOT EXISTS permissions TEXT;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'utp_user_team_unique'
        ) THEN
          ALTER TABLE user_team_permissions ADD CONSTRAINT utp_user_team_unique UNIQUE (user_id, team_id);
        END IF;
      END $$;
      ALTER TABLE user_team_permissions ADD COLUMN IF NOT EXISTS group_scope TEXT NOT NULL DEFAULT '';
      ALTER TABLE user_team_permissions ADD COLUMN IF NOT EXISTS is_team_admin INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE watch_sessions ADD COLUMN IF NOT EXISTS operator_name TEXT;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS watch_operator_name TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS login_locked INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS grind_profiles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        grind_type TEXT NOT NULL,
        stone TEXT NOT NULL,
        pattern TEXT NOT NULL,
        extra_params TEXT,
        created_by_name TEXT NOT NULL,
        team_id INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      ALTER TABLE test_entries ADD COLUMN IF NOT EXISTS grind_extra_params TEXT;
      ALTER TABLE test_entries ADD COLUMN IF NOT EXISTS grind_type TEXT;
      ALTER TABLE test_entries ADD COLUMN IF NOT EXISTS grind_stone TEXT;
      ALTER TABLE test_entries ADD COLUMN IF NOT EXISTS grind_pattern TEXT;
      ALTER TABLE grind_profiles ADD COLUMN IF NOT EXISTS grind_id TEXT;
      ALTER TABLE grind_profiles ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE grind_profiles ADD COLUMN IF NOT EXISTS archived INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE test_entries ADD COLUMN IF NOT EXISTS grind_profile_id INTEGER;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_paused INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS plan_name TEXT DEFAULT 'free';
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS current_period_end TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS trial_ends_at TEXT;
      UPDATE users SET username = email WHERE username IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS start_time TEXT;
      CREATE TABLE IF NOT EXISTS inbox_messages (
        id SERIAL PRIMARY KEY,
        to_user_id INTEGER NOT NULL,
        from_user_id INTEGER,
        from_name TEXT,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        team_name TEXT
      );
      CREATE TABLE IF NOT EXISTS interest_registrations (
        id SERIAL PRIMARY KEY,
        created_at TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        team_name TEXT NOT NULL,
        plan_name TEXT NOT NULL DEFAULT 'team',
        user_count INTEGER,
        group_count INTEGER,
        billing_period TEXT DEFAULT 'monthly',
        invoice_address TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        admin_notes TEXT
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT;
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS action_type TEXT;
      ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS action_data TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'no';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'european';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_unit TEXT DEFAULT 'C';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS result_unit TEXT;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS fleet_group TEXT;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS is_fleet INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS is_profile_only INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE ski_race_usages ADD COLUMN IF NOT EXISTS used_by_athlete_id INTEGER;
      ALTER TABLE ski_race_usages ADD COLUMN IF NOT EXISTS wax_notes TEXT;
      CREATE TABLE IF NOT EXISTS scan_corrections (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        scanned TEXT NOT NULL,
        brand TEXT NOT NULL,
        name TEXT NOT NULL,
        hits INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT '',
        UNIQUE (team_id, scanned)
      );
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS updated_at TEXT;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS updated_by_id INTEGER;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS updated_by_name TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_by_id INTEGER;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_by_name TEXT;
      ALTER TABLE test_ski_series ADD COLUMN IF NOT EXISTS updated_at TEXT;
      ALTER TABLE test_ski_series ADD COLUMN IF NOT EXISTS updated_by_id INTEGER;
      ALTER TABLE test_ski_series ADD COLUMN IF NOT EXISTS updated_by_name TEXT;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS updated_at TEXT;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS updated_by_id INTEGER;
      ALTER TABLE race_skis ADD COLUMN IF NOT EXISTS updated_by_name TEXT;
      ALTER TABLE daily_weather ADD COLUMN IF NOT EXISTS updated_at TEXT;
      ALTER TABLE daily_weather ADD COLUMN IF NOT EXISTS updated_by_id INTEGER;
      ALTER TABLE daily_weather ADD COLUMN IF NOT EXISTS updated_by_name TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Oslo';
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NOK';
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS vat_exempt INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS last_drive_backup_day TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS nation TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS nation_theme_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TEXT;
      CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO app_settings (key, value) VALUES ('commercialization_enabled', 'false') ON CONFLICT (key) DO NOTHING;
    `);
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_athlete_access INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_athlete_id INTEGER;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        invited_by_id INTEGER NOT NULL,
        invited_by_name TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS billing_records (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        team_name TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'NOK',
        description TEXT,
        period_start TEXT,
        period_end TEXT,
        due_date TEXT NOT NULL,
        invoiced_at TEXT,
        paid_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
      )
    `);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_price REAL`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly'`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS next_billing_date TEXT`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS max_users INTEGER`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS max_groups INTEGER`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS max_tests INTEGER`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS max_products INTEGER`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS notes TEXT`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS weather_station_type TEXT`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS weather_station_config TEXT`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_logo TEXT`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS drive_folder_id TEXT`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS drive_json_file_id TEXT`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS drive_pdf_file_id TEXT`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plan_change_log (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        team_name TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        changed_by TEXT,
        old_plan TEXT,
        new_plan TEXT,
        old_price REAL,
        new_price REAL,
        billing_period TEXT,
        notes TEXT
      )
    `);
    await pool.query(`ALTER TABLE interest_registrations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'`).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_attachments (
        id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        uploaded_by_id INTEGER
      )
    `);
    await pool.query(`ALTER TABLE test_attachments ADD COLUMN IF NOT EXISTS url TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS share_token TEXT`).catch(() => {});
    // Watch-app distribution (#19–21): SA uploads the Garmin watch-app file that
    // must be sideloaded via cable; TAs with permission download it from their
    // Admin page; each download is logged so the SA has an overview.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS watch_app (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        data TEXT,
        url TEXT,
        version TEXT,
        notes TEXT,
        uploaded_at TEXT NOT NULL,
        uploaded_by_id INTEGER,
        uploaded_by_name TEXT
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS watch_app_downloads (
        id SERIAL PRIMARY KEY,
        watch_app_id INTEGER,
        team_id INTEGER,
        team_name TEXT,
        user_id INTEGER,
        user_name TEXT,
        downloaded_at TEXT NOT NULL
      )
    `);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS watch_app_download INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_errors (
        id SERIAL PRIMARY KEY,
        message TEXT,
        stack TEXT,
        component_stack TEXT,
        label TEXT,
        href TEXT,
        user_agent TEXT,
        user_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS test_comments (
        id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS test_comments_test_id_idx ON test_comments(test_id);
      CREATE TABLE IF NOT EXISTS athlete_race_calendar (
        id SERIAL PRIMARY KEY,
        athlete_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        race_name TEXT NOT NULL,
        location TEXT,
        discipline TEXT,
        notes TEXT,
        created_by_id INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS athlete_transfers (
        id SERIAL PRIMARY KEY,
        athlete_id INTEGER NOT NULL,
        from_team_id INTEGER NOT NULL,
        to_team_id INTEGER,
        to_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_by_id INTEGER NOT NULL,
        requested_by_name TEXT NOT NULL DEFAULT '',
        accepted_by_id INTEGER,
        accepted_at TEXT,
        grace_until TEXT,
        prev_main_waxer_id INTEGER,
        prev_main_waxer_name TEXT,
        strip_products INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT ''
      );
      ALTER TABLE athlete_transfers ADD COLUMN IF NOT EXISTS strip_products INTEGER NOT NULL DEFAULT 1;
      CREATE INDEX IF NOT EXISTS athlete_transfers_athlete_idx ON athlete_transfers(athlete_id);
      CREATE INDEX IF NOT EXISTS athlete_transfers_from_idx ON athlete_transfers(from_team_id);
      CREATE TABLE IF NOT EXISTS athlete_loans (
        id SERIAL PRIMARY KEY,
        athlete_id INTEGER NOT NULL,
        owner_team_id INTEGER NOT NULL,
        to_team_id INTEGER,
        to_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        can_edit INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        requested_by_id INTEGER NOT NULL,
        requested_by_name TEXT NOT NULL DEFAULT '',
        accepted_by_id INTEGER,
        accepted_at TEXT,
        created_at TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS athlete_loans_athlete_idx ON athlete_loans(athlete_id);
      CREATE INDEX IF NOT EXISTS athlete_loans_to_idx ON athlete_loans(to_team_id);
      CREATE TABLE IF NOT EXISTS team_join_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_by_id INTEGER NOT NULL,
        requested_by_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS race_preps (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        location TEXT NOT NULL,
        race_type TEXT NOT NULL,
        discipline TEXT NOT NULL,
        products TEXT,
        method TEXT,
        structure TEXT,
        notes TEXT,
        created_by_id INTEGER NOT NULL,
        created_by_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS race_prep_entries (
        id SERIAL PRIMARY KEY,
        race_prep_id INTEGER NOT NULL,
        athlete_id INTEGER NOT NULL,
        athlete_name TEXT NOT NULL,
        ski_id TEXT,
        waxer_id INTEGER,
        waxer_name TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS race_prep_comments (
        id SERIAL PRIMARY KEY,
        race_prep_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (now())::text
      );
      CREATE INDEX IF NOT EXISTS race_prep_comments_prep_id_idx ON race_prep_comments(race_prep_id);
      ALTER TABLE race_preps ADD COLUMN IF NOT EXISTS product_ids TEXT;
      ALTER TABLE race_preps ADD COLUMN IF NOT EXISTS structure_ids TEXT;
      ALTER TABLE race_preps ADD COLUMN IF NOT EXISTS kick_product_ids TEXT;
      ALTER TABLE race_preps ADD COLUMN IF NOT EXISTS tette TEXT;
      ALTER TABLE race_preps ADD COLUMN IF NOT EXISTS weather_id INTEGER;
      ALTER TABLE race_preps ADD COLUMN IF NOT EXISTS start_time TEXT;
      ALTER TABLE race_preps ADD COLUMN IF NOT EXISTS product_apps TEXT;
      ALTER TABLE race_preps ADD COLUMN IF NOT EXISTS structure_apps TEXT;
      ALTER TABLE race_prep_entries ADD COLUMN IF NOT EXISTS ski_id_classic TEXT;
      ALTER TABLE race_prep_entries ADD COLUMN IF NOT EXISTS ski_id_skating TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at TEXT;

      -- Make humidity fields nullable so manual weather entry can omit them
      ALTER TABLE daily_weather ALTER COLUMN snow_humidity_pct DROP NOT NULL;
      ALTER TABLE daily_weather ALTER COLUMN air_humidity_pct DROP NOT NULL;

      -- Performance indexes on high-frequency query columns
      CREATE INDEX IF NOT EXISTS tests_team_id_idx          ON tests(team_id);
      CREATE INDEX IF NOT EXISTS tests_created_by_id_idx    ON tests(created_by_id);
      CREATE INDEX IF NOT EXISTS test_entries_test_id_idx   ON test_entries(test_id);
      CREATE INDEX IF NOT EXISTS products_team_id_idx       ON products(team_id);
      CREATE INDEX IF NOT EXISTS daily_weather_team_id_idx  ON daily_weather(team_id);
      CREATE INDEX IF NOT EXISTS activity_logs_team_id_idx  ON activity_logs(team_id);
      CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx  ON activity_logs(user_id);
      ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS snapshot TEXT;
      CREATE INDEX IF NOT EXISTS login_logs_user_id_idx     ON login_logs(user_id);
      CREATE INDEX IF NOT EXISTS race_skis_athlete_id_idx   ON race_skis(athlete_id);
      CREATE INDEX IF NOT EXISTS athlete_access_user_id_idx ON athlete_access(user_id);
      CREATE INDEX IF NOT EXISTS grinding_records_team_id_idx ON grinding_records(team_id);
      CREATE INDEX IF NOT EXISTS grind_profiles_team_id_idx   ON grind_profiles(team_id);
      CREATE INDEX IF NOT EXISTS race_preps_team_id_idx       ON race_preps(team_id);
      -- Winter-load hardening: indexes for every remaining hot lookup so no
      -- request degrades to a sequential scan as the season's data grows.
      CREATE INDEX IF NOT EXISTS tests_date_idx                 ON tests(date);
      CREATE INDEX IF NOT EXISTS tests_weather_id_idx           ON tests(weather_id);
      CREATE INDEX IF NOT EXISTS tests_athlete_id_idx           ON tests(athlete_id);
      CREATE INDEX IF NOT EXISTS test_entries_product_id_idx    ON test_entries(product_id);
      CREATE INDEX IF NOT EXISTS test_entries_race_ski_id_idx   ON test_entries(race_ski_id);
      CREATE INDEX IF NOT EXISTS athletes_team_id_idx           ON athletes(team_id);
      CREATE INDEX IF NOT EXISTS athlete_access_athlete_id_idx  ON athlete_access(athlete_id);
      CREATE INDEX IF NOT EXISTS race_ski_regrinds_ski_idx      ON race_ski_regrinds(race_ski_id);
      CREATE INDEX IF NOT EXISTS ski_race_usages_ski_idx        ON ski_race_usages(ski_id);
      CREATE INDEX IF NOT EXISTS test_ski_series_team_id_idx    ON test_ski_series(team_id);
      CREATE INDEX IF NOT EXISTS test_ski_regrinds_series_idx   ON test_ski_regrinds(series_id);
      CREATE INDEX IF NOT EXISTS kick_tests_team_id_idx         ON kick_tests(team_id);
      CREATE INDEX IF NOT EXISTS kick_skis_team_id_idx          ON kick_skis(team_id);
      CREATE INDEX IF NOT EXISTS kick_mixes_team_id_idx         ON kick_mixes(team_id);
      CREATE INDEX IF NOT EXISTS kick_test_entries_test_idx     ON kick_test_entries(kick_test_id);
      CREATE INDEX IF NOT EXISTS race_prep_entries_prep_idx     ON race_prep_entries(race_prep_id);
      CREATE INDEX IF NOT EXISTS watch_queue_team_status_idx    ON watch_queue(team_id, status);
      CREATE INDEX IF NOT EXISTS runsheet_progress_test_idx     ON runsheet_progress(test_id);
      CREATE INDEX IF NOT EXISTS runsheet_progress_user_idx     ON runsheet_progress(user_id);
      CREATE INDEX IF NOT EXISTS inbox_messages_to_user_idx     ON inbox_messages(to_user_id);
      CREATE INDEX IF NOT EXISTS user_teams_user_id_idx         ON user_teams(user_id);
      CREATE INDEX IF NOT EXISTS utp_user_id_idx                ON user_team_permissions(user_id);
      CREATE INDEX IF NOT EXISTS utp_team_id_idx                ON user_team_permissions(team_id);
      CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx   ON activity_logs(created_at);
      CREATE INDEX IF NOT EXISTS activity_logs_action_idx       ON activity_logs(action);
      CREATE INDEX IF NOT EXISTS cve_parent_team_idx            ON child_visibility_exclusions(parent_team_id);
      CREATE INDEX IF NOT EXISTS test_attachments_test_idx      ON test_attachments(test_id);
      CREATE INDEX IF NOT EXISTS daily_weather_date_idx         ON daily_weather(date);
      CREATE INDEX IF NOT EXISTS grinding_sheets_team_idx       ON grinding_sheets(team_id);
    `);
  }

  // Retrofit: existing kick mixes without a linked product get a 700-series
  // serial + product card, so search/history covers them from day one.
  (async () => {
    try {
      const { pool: pRf } = await import("./db");
      const orphans = await (pRf as any).query(`SELECT * FROM kick_mixes WHERE product_id IS NULL`);
      for (const km of orphans.rows) {
        const serial = await nextMixSerial(km.team_id, "kick");
        if (!serial) continue;
        const created = await storage.createProduct({
          category: "Kick", brand: "Mix", name: km.name,
          serialNumber: serial, isMix: 1,
          recipe: JSON.stringify({ kind: "kick", components: km.products ? JSON.parse(km.products) : [], notes: km.notes || null }),
          createdAt: km.created_at || new Date().toISOString(),
          createdById: km.created_by_id, createdByName: km.created_by_name,
          groupScope: km.group_scope || "", teamId: km.team_id,
        } as any);
        await (pRf as any).query(`UPDATE kick_mixes SET product_id = $1 WHERE id = $2`, [created.id, km.id]);
      }
      if (orphans.rows.length > 0) console.log(`[Mixes] Retrofitted ${orphans.rows.length} kick mix(es) with serials + product cards`);
    } catch (e) { console.error('[Mixes] Retrofit failed:', e); }
  })();

  // Orphan sweep: teams deleted BEFORE cascade deletion existed left their
  // data behind (visible as tests from nonexistent teams on All teams).
  // Idempotent, runs at every boot after migrations.
  (async () => {
    try {
      const { pool: pOrf } = await import("./db");
      const colRes = await (pOrf as any).query(
        `SELECT DISTINCT table_name FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'team_id'
           AND table_name NOT IN ('teams', 'users')`);
      let removed = 0;
      for (const { table_name } of colRes.rows) {
        const r = await (pOrf as any).query(
          `DELETE FROM "${table_name}" WHERE team_id IS NOT NULL AND team_id NOT IN (SELECT id FROM teams)`).catch(() => null);
        removed += r?.rowCount ?? 0;
      }
      // Children whose parents are gone.
      const CHILD_SWEEP: [string, string, string][] = [
        ["test_entries", "test_id", "tests"],
        ["test_comments", "test_id", "tests"],
        ["test_attachments", "test_id", "tests"],
        ["runsheet_progress", "test_id", "tests"],
        ["kick_test_entries", "kick_test_id", "kick_tests"],
        ["race_prep_entries", "race_prep_id", "race_preps"],
        ["race_ski_regrinds", "race_ski_id", "race_skis"],
        ["test_ski_regrinds", "series_id", "test_ski_series"],
        ["athlete_access", "athlete_id", "athletes"],
      ];
      for (const [child, col, parent] of CHILD_SWEEP) {
        const r = await (pOrf as any).query(
          `DELETE FROM "${child}" WHERE "${col}" IS NOT NULL AND "${col}" NOT IN (SELECT id FROM "${parent}")`).catch(() => null);
        removed += r?.rowCount ?? 0;
      }
      if (removed > 0) console.log(`[OrphanSweep] Removed ${removed} rows left behind by pre-cascade team deletions`);
    } catch (e) { console.error("[OrphanSweep] failed:", e); }
  })();

  // Keep per-team permissions/scope/TA-flag fresh for shared users, so an
  // access change takes effect within seconds instead of requiring a re-login.
  app.use("/api", async (req: Request, _res: Response, next: NextFunction) => {
    if (req.isAuthenticated?.() && req.user) {
      try { await refreshPerTeamAccess(req); } catch { /* never block the request */ }
    }
    next();
  });

  // --- Maintenance mode gate (runs before all other /api routes) ---
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (!maintenanceMode) return next();
    // Always allow health check, auth, maintenance-mode status, and Garmin watch endpoints
    const exemptPaths = ["/api/health", "/api/admin/maintenance-mode"];
    if (exemptPaths.includes(req.path)) return next();
    // req.path inside app.use("/api", ...) includes the /api prefix
    if (req.path.startsWith("/api/auth/") || req.path.startsWith("/api/watch/") || req.path.startsWith("/api/runsheet/watch")) return next();
    // Super Admins always pass through
    if (req.isAuthenticated() && (req.user as any)?.isAdmin === 1) return next();
    const reopenMsg = maintenanceReopenAt
      ? ` The system will reopen at ${new Date(maintenanceReopenAt).toLocaleString("no-NO", { dateStyle: "short", timeStyle: "short" })}.`
      : " The system will be back shortly.";
    return res.status(503).json({
      message: `Maintenance in progress.${reopenMsg} If you have urgent needs, contact your Team Admin.`,
      maintenance: true,
      reopenAt: maintenanceReopenAt,
    });
  });

  // --- Health check (used by keep-alive ping) ---
  app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // --- Client error logging (no auth required, never crashes) ---
  app.post("/api/client-errors", async (req, res) => {
    const { message, stack, componentStack, label, href, ua } = req.body;
    try {
      const { pool } = await import("./db");
      await (pool as any).query(
        `INSERT INTO client_errors (message, stack, component_stack, label, href, user_agent, user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [
          String(message ?? "").slice(0, 500),
          String(stack ?? "").slice(0, 2000),
          String(componentStack ?? "").slice(0, 2000),
          String(label ?? "").slice(0, 100),
          String(href ?? "").slice(0, 200),
          String(ua ?? "").slice(0, 300),
          (req as any).user?.id ?? null,
        ]
      );
    } catch {} // Never crash on error logging
    return res.json({ ok: true });
  });

  // SA: view recent client-side crashes (from the error boundary).
  app.get("/api/admin/client-errors", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    try {
      const { pool } = await import("./db");
      const r = await (pool as any).query(
        `SELECT id, message, stack, component_stack AS "componentStack", label, href,
                user_agent AS "userAgent", user_id AS "userId", created_at AS "createdAt"
         FROM client_errors ORDER BY created_at DESC LIMIT 50`);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e?.message }); }
  });

  // --- Public app settings (no auth required) ---
  // SA-only: send a test email to verify Resend is working
  app.post("/api/admin/test-email", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const to = req.body.to || u.email;
    try {
      const { sendPasswordResetEmail } = await import("./email");
      await sendPasswordResetEmail(to, u.name || "Test", "https://glidr.no/reset-password?token=testtoken123", "no");
      res.json({ ok: true, message: `Test email sent to ${to}` });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/api/settings/public", async (_req, res) => {
    try {
      const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'commercialization_enabled'`);
      const row = ((rows as any).rows ?? rows)[0];
      res.json({ commercializationEnabled: row?.value !== 'false' });
    } catch {
      res.json({ commercializationEnabled: true });
    }
  });

  // GET /api/settings/plan-prices — public, returns prices for all plans in NOK
  app.get("/api/settings/plan-prices", async (_req, res) => {
    try {
      const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'plan_prices'`);
      const row = ((rows as any).rows ?? rows)[0];
      const defaults = { free: 0, starter: 490, team: 790, pro: 1490, enterprise: null };
      if (!row?.value) return res.json(defaults);
      try { return res.json({ ...defaults, ...JSON.parse(row.value) }); }
      catch { return res.json(defaults); }
    } catch {
      res.json({ free: 0, starter: 490, team: 790, pro: 1490, enterprise: null });
    }
  });

  // GET /api/settings/plan-builder-pricing — public: effective per-feature
  // pricing for the self-service plan builder (defaults merged with the SA's
  // overrides from app_settings). The signup endpoint computes from the same
  // source, so what the visitor sees is exactly what is billed.
  app.get("/api/settings/plan-builder-pricing", async (_req, res) => {
    const { resolvePricing } = await import("@shared/pricing");
    let overrides: any = null;
    try {
      const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'plan_builder_pricing'`);
      const row = ((rows as any).rows ?? rows)[0];
      if (row?.value) overrides = JSON.parse(row.value);
    } catch { /* defaults */ }
    res.json(resolvePricing(overrides));
  });

  // GET /api/settings/currency-rates — NOK per foreign unit (SA-maintained).
  app.get("/api/settings/currency-rates", requireAuth, async (_req, res) => {
    try {
      const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'currency_rates'`);
      const row = ((rows as any).rows ?? rows)[0];
      return res.json(row?.value ? JSON.parse(row.value) : {});
    } catch { return res.json({}); }
  });

  app.patch("/api/admin/currency-rates", requireAuth, async (req, res) => {
    if ((req.user as any).isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const clean: Record<string, number> = {};
    for (const k of ["EUR", "USD"]) {
      const v = Number(req.body?.[k]);
      if (!isNaN(v) && v > 0) clean[k] = v;
    }
    await db.execute(sql`
      INSERT INTO app_settings (key, value) VALUES ('currency_rates', ${JSON.stringify(clean)})
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(clean)}`);
    res.json({ ok: true, rates: clean });
  });

  // PATCH /api/admin/plan-builder-pricing — SA only: override feature prices
  // and limit pricing for the plan builder. Merged with existing overrides.
  app.patch("/api/admin/plan-builder-pricing", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    let current: any = {};
    try {
      const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'plan_builder_pricing'`);
      const row = ((rows as any).rows ?? rows)[0];
      if (row?.value) current = JSON.parse(row.value);
    } catch { /* start empty */ }
    const clean = (o: any) => {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(o ?? {})) {
        const n = Number(v);
        if (!isNaN(n) && n >= 0) out[k] = n;
      }
      return out;
    };
    const merged = {
      featurePrices: { ...(current.featurePrices ?? {}), ...clean(req.body.featurePrices) },
      users: { ...(current.users ?? {}), ...clean(req.body.users) },
      groups: { ...(current.groups ?? {}), ...clean(req.body.groups) },
    };
    await db.execute(sql`
      INSERT INTO app_settings (key, value) VALUES ('plan_builder_pricing', ${JSON.stringify(merged)})
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(merged)}
    `);
    const { resolvePricing } = await import("@shared/pricing");
    res.json(resolvePricing(merged));
  });

  // ── Test protocol (SA) ─────────────────────────────────────────────────────
  // Step-by-step verification checklist state: per-step OK / issue + note,
  // persisted in app_settings so progress survives sessions and devices.
  app.get("/api/admin/test-protocol", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    try {
      const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'test_protocol_state'`);
      const row = ((rows as any).rows ?? rows)[0];
      res.json(row?.value ? JSON.parse(row.value) : {});
    } catch { res.json({}); }
  });
  app.put("/api/admin/test-protocol", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    let current: Record<string, any> = {};
    try {
      const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'test_protocol_state'`);
      const row = ((rows as any).rows ?? rows)[0];
      if (row?.value) current = JSON.parse(row.value);
    } catch { /* start empty */ }
    if (req.body.reset === true) {
      current = {};
    } else {
      const stepId = String(req.body.stepId ?? "");
      if (!stepId) return res.status(400).json({ message: "stepId required" });
      const status = req.body.status === "ok" || req.body.status === "issue" ? req.body.status : null;
      if (status == null) delete current[stepId];
      else current[stepId] = { status, note: String(req.body.note ?? ""), at: new Date().toISOString(), by: u.name };
    }
    await db.execute(sql`
      INSERT INTO app_settings (key, value) VALUES ('test_protocol_state', ${JSON.stringify(current)})
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(current)}
    `);
    res.json(current);
  });

  // PATCH /api/admin/plan-prices — SA only, update global plan prices
  app.patch("/api/admin/plan-prices", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const { free, starter, team, pro, enterprise } = req.body;
    const prices: Record<string, number | null> = {};
    if (free !== undefined) prices.free = free === null ? 0 : Number(free);
    if (starter !== undefined) prices.starter = starter === null ? null : Number(starter);
    if (team !== undefined) prices.team = team === null ? null : Number(team);
    if (pro !== undefined) prices.pro = pro === null ? null : Number(pro);
    if (enterprise !== undefined) prices.enterprise = enterprise === null ? null : Number(enterprise);
    // Read existing, merge, write back
    const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'plan_prices'`);
    const existing = ((rows as any).rows ?? rows)[0];
    const current = existing?.value ? JSON.parse(existing.value) : {};
    const merged = { ...current, ...prices };
    await db.execute(sql`
      INSERT INTO app_settings (key, value) VALUES ('plan_prices', ${JSON.stringify(merged)})
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(merged)}
    `);
    res.json(merged);
  });

  // --- SA settings update ---
  app.patch("/api/admin/settings", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const { commercializationEnabled } = req.body;
    if (typeof commercializationEnabled === 'boolean') {
      await db.execute(sql`UPDATE app_settings SET value = ${commercializationEnabled ? 'true' : 'false'} WHERE key = 'commercialization_enabled'`);
    }
    res.json({ ok: true });
  });

  // --- Global search ---
  app.get("/api/search", requireAuth, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json([]);
    const u = req.user!;
    const uu = u as any;
    const teamId = uu.activeTeamId || u.teamId;
    const like = `%${q.toLowerCase()}%`;
    const { pool } = await import("./db");
    const perms = parsePermissions(getEffectivePermissionsStr(req), u.isAdmin === 1, getEffectiveIsTeamAdmin(req));
    const isAthleteAccess = uu.isAthleteAccess === 1;
    const isBlind = u.isBlindTester === 1;

    const [testsRes, productsRes, skisRes, athletesRes, grindRes, weatherRes] = await Promise.all([
      // Tests: always filter by team; athlete access users only see their raceski tests
      isAthleteAccess
        ? (pool as any).query(
            `SELECT id, test_name, location, date, test_type FROM tests
             WHERE team_id = $1 AND athlete_id = $4 AND test_ski_source = 'raceskis'
             AND (LOWER(test_name) LIKE $2 OR LOWER(location) LIKE $2)
             ORDER BY date DESC LIMIT 8`,
            [teamId, like, u.id, uu.linkedAthleteId]
          )
        : (pool as any).query(
            `SELECT id, test_name, location, date, test_type FROM tests
             WHERE team_id = $1 AND (LOWER(test_name) LIKE $2 OR LOWER(location) LIKE $2)
             ORDER BY date DESC LIMIT 8`,
            [teamId, like]
          ),
      // Products: hide from blind testers and athlete access users
      (!isBlind && !isAthleteAccess && perms.products !== "none")
        ? (pool as any).query(
            `SELECT id, brand, name, category FROM products
             WHERE team_id = $1 AND (LOWER(brand) LIKE $2 OR LOWER(name) LIKE $2)
             ORDER BY brand, name LIMIT 8`,
            [teamId, like]
          )
        : Promise.resolve({ rows: [] }),
      // Test ski series: hide from athlete access users
      (!isAthleteAccess && perms.testskis !== "none")
        ? (pool as any).query(
            `SELECT tss.id, tss.name FROM test_ski_series tss
             WHERE tss.team_id = $1 AND LOWER(tss.name) LIKE $2
             ORDER BY tss.name LIMIT 5`,
            [teamId, like]
          )
        : Promise.resolve({ rows: [] }),
      // Athletes: athlete access users only see their own
      (perms.raceskis !== "none")
        ? isAthleteAccess
          ? (pool as any).query(
              `SELECT id, name, team FROM athletes WHERE id = $1 AND LOWER(name) LIKE $2 LIMIT 1`,
              [uu.linkedAthleteId, like]
            )
          : (pool as any).query(
              `SELECT a.id, a.name, a.team FROM athletes a
               INNER JOIN athlete_access aa ON aa.athlete_id = a.id
               WHERE a.team_id = $1 AND LOWER(a.name) LIKE $2
               UNION
               SELECT a.id, a.name, a.team FROM athletes a
               WHERE a.team_id = $1 AND a.created_by_id = $3 AND LOWER(a.name) LIKE $2
               LIMIT 6`,
              [teamId, like, u.id]
            )
        : Promise.resolve({ rows: [] }),
      // Grind profiles: hide from athlete access users and users without grinding permission
      (!isAthleteAccess && perms.grinding !== "none")
        ? (pool as any).query(
            `SELECT id, name, grind_type, stone FROM grind_profiles
             WHERE team_id = $1 AND archived = 0 AND (LOWER(name) LIKE $2 OR LOWER(grind_type) LIKE $2)
             ORDER BY id DESC LIMIT 6`,
            [teamId, like]
          )
        : Promise.resolve({ rows: [] }),
      // Weather: hide from athlete access users and users without weather permission
      (!isAthleteAccess && perms.weather !== "none")
        ? (pool as any).query(
            `SELECT id, location, date, snow_temperature_c, air_temperature_c FROM daily_weather
             WHERE team_id = $1 AND LOWER(location) LIKE $2
             ORDER BY date DESC LIMIT 5`,
            [teamId, like]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const results = [
      ...testsRes.rows.map((r: any) => ({
        type: "test" as const,
        id: r.id,
        title: r.test_name || r.location,
        subtitle: `${r.date} · ${r.test_type} · ${r.location}`,
        href: `/tests/${r.id}`,
      })),
      ...productsRes.rows.map((r: any) => ({
        type: "product" as const,
        id: r.id,
        title: `${r.brand} ${r.name}`,
        subtitle: r.category,
        href: `/products`,
      })),
      ...skisRes.rows.map((r: any) => ({
        type: "series" as const,
        id: r.id,
        title: r.name,
        subtitle: "Test ski series",
        href: `/testskis`,
      })),
      ...athletesRes.rows.map((r: any) => ({
        type: "athlete" as const,
        id: r.id,
        title: r.name,
        subtitle: r.team ? `Team: ${r.team}` : "Athlete",
        href: `/raceskis/${r.id}`,
      })),
      ...grindRes.rows.map((r: any) => ({
        type: "grind" as const,
        id: r.id,
        title: r.name,
        subtitle: `${r.grind_type}${r.stone ? ` · ${r.stone}` : ""}`,
        href: `/grinding?tab=grinds`,
      })),
      ...weatherRes.rows.map((r: any) => ({
        type: "weather" as const,
        id: r.id,
        title: r.location,
        subtitle: `${r.date}${r.snow_temperature_c != null ? ` · Snow ${r.snow_temperature_c}°C` : ""}`,
        href: `/weather`,
      })),
    ];

    return res.json(results);
  });

  // --- Teams CRUD ---
  app.get("/api/teams", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin === 1) {
      const list = await storage.listTeams();
      return res.json(list);
    }
    // Non-SA: every team the user belongs to — primary AND teams they are
    // shared into. Admin surfaces (e.g. the per-team access dialog for shared
    // users) need the ACTIVE team resolvable even when it isn't the primary.
    const memberships = await storage.getUserTeams(u.id);
    const ids = new Set<number>([u.teamId, ...memberships.map((m) => m.teamId)]);
    const all = await storage.listTeams();
    // Parent-team TAs also see (and administer) their child teams.
    if (u.isTeamAdmin === 1) {
      for (const t of all) if ((t as any).parentTeamId === u.teamId) ids.add(t.id);
    }
    res.json(all.filter((t) => ids.has(t.id)));
  });

  app.post("/api/teams", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    const data: any = { name, createdAt: new Date().toISOString() };
    if (req.body.enabledAreas !== undefined) {
      data.enabledAreas = JSON.stringify(req.body.enabledAreas);
    }
    if (req.body.timezone) data.timezone = String(req.body.timezone);
    const team = await storage.createTeam(data);
    res.json(team);
  });

  app.put("/api/teams/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const id = parseInt(req.params.id);
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    const data: any = { name };
    if (req.body.enabledAreas !== undefined) {
      data.enabledAreas = JSON.stringify(req.body.enabledAreas);
    }
    if (req.body.timezone !== undefined) data.timezone = String(req.body.timezone) || "Europe/Oslo";
    if (req.body.currency !== undefined) {
      const cur = String(req.body.currency).toUpperCase();
      if (!["NOK", "EUR", "USD"].includes(cur)) return res.status(400).json({ message: "currency must be NOK, EUR or USD" });
      data.currency = cur;
    }
    if (req.body.vatExempt !== undefined) data.vatExempt = req.body.vatExempt ? 1 : 0;
    const updated = await storage.updateTeam(id, data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.post("/api/teams/:id/set-default", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const id = parseInt(req.params.id);
    const team = await storage.getTeam(id);
    if (!team) return res.status(404).json({ message: "Team not found" });
    await storage.setDefaultTeam(id);
    res.json({ ok: true });
  });

  app.delete("/api/teams/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const id = parseInt(req.params.id);
    const team = await storage.getTeam(id);
    if (!team) return res.status(404).json({ message: "Not found" });
    if (team.isDefault === 1) return res.status(400).json({ message: "Cannot delete the default team. Set another team as default first." });

    // Farewell snapshot: a final forced Drive backup so the team's data
    // survives in the archive even after deletion. Best-effort — a team
    // without Drive configured still deletes.
    try {
      const { runDriveBackupForTeam } = await import("./backup");
      await runDriveBackupForTeam(id, { force: true });
    } catch (e) { console.error(`[team-delete] farewell backup failed for team ${id}:`, e); }

    // Cascade over EVERY table, discovered from the live schema like the
    // export engine — a hand-kept list here would silently orphan data from
    // tables added later.
    try {
      const { pool: pDel } = await import("./db");
      const { EXPORT_CHILD_JOINS } = await import("./backup");
      const colRes = await (pDel as any).query(
        `SELECT DISTINCT table_name FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'team_id' AND table_name <> 'teams'`);
      const teamIdTables: string[] = colRes.rows.map((r: any) => r.table_name);
      const withTeamId = new Set(teamIdTables);

      // 1) Child tables without team_id first — their filters need the parent rows.
      for (const [table, cond] of Object.entries(EXPORT_CHILD_JOINS)) {
        if (withTeamId.has(table)) continue;
        await (pDel as any).query(`DELETE FROM "${table}" WHERE ${cond}`, [id]).catch((e: any) =>
          console.error(`[team-delete] ${table}:`, e?.message));
      }

      // 2) Member accounts: users whose PRIMARY team this is are repointed to
      // another membership when they have one, otherwise fully purged (same
      // no-trace cleanup as single-user deletion).
      const members = await (pDel as any).query(
        `SELECT id, email FROM users WHERE team_id = $1 AND is_admin <> 1`, [id]);
      for (const m of members.rows) {
        const other = await (pDel as any).query(
          `SELECT team_id FROM user_teams WHERE user_id = $1 AND team_id <> $2 LIMIT 1`, [m.id, id]);
        if (other.rows.length > 0) {
          await (pDel as any).query(`UPDATE users SET team_id = $1 WHERE id = $2`, [other.rows[0].team_id, m.id]);
        } else {
          await (pDel as any).query(`DELETE FROM login_logs WHERE user_id = $1`, [m.id]).catch(() => {});
          await (pDel as any).query(`DELETE FROM user_teams WHERE user_id = $1`, [m.id]).catch(() => {});
          await (pDel as any).query(`DELETE FROM user_team_permissions WHERE user_id = $1`, [m.id]).catch(() => {});
          await (pDel as any).query(`DELETE FROM athlete_access WHERE user_id = $1`, [m.id]).catch(() => {});
          await (pDel as any).query(`DELETE FROM inbox_messages WHERE to_user_id = $1`, [m.id]).catch(() => {});
          await (pDel as any).query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [m.id]).catch(() => {});
          await (pDel as any).query(`DELETE FROM invitations WHERE email = $1`, [m.email ?? ""]).catch(() => {});
          await (pDel as any).query(`DELETE FROM user_sessions WHERE sess->'passport'->>'user' = $1`, [String(m.id)]).catch(() => {});
          await (pDel as any).query(`DELETE FROM users WHERE id = $1`, [m.id]).catch((e: any) =>
            console.error(`[team-delete] user ${m.id}:`, e?.message));
        }
      }
      // SA accounts parked on this team keep existing — repoint to the default team.
      await (pDel as any).query(
        `UPDATE users SET team_id = (SELECT id FROM teams WHERE is_default = 1 LIMIT 1)
         WHERE team_id = $1 AND is_admin = 1`, [id]).catch(() => {});

      // 3) Every table with a team_id column (users handled above).
      for (const table of teamIdTables) {
        if (table === "users") continue;
        await (pDel as any).query(`DELETE FROM "${table}" WHERE team_id = $1`, [id]).catch((e: any) =>
          console.error(`[team-delete] ${table}:`, e?.message));
      }

      // 4) Cross-team references: curation rows and child teams of this team.
      await (pDel as any).query(`DELETE FROM child_visibility_exclusions WHERE parent_team_id = $1`, [id]).catch(() => {});
      await (pDel as any).query(`UPDATE teams SET parent_team_id = NULL WHERE parent_team_id = $1`, [id]).catch(() => {});
    } catch (e) {
      console.error(`[team-delete] cascade failed for team ${id}:`, e);
      return res.status(500).json({ message: "Deletion failed while removing the team's data — nothing was left in an unknown state, try again." });
    }

    // 5) The team row itself, with an audit snapshot under the SA's log.
    await recordDeletion(req, "team", id, `Team deleted with all data: ${team.name}`, team);
    const deleted = await storage.deleteTeam(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // Check whether Google Sheets backup is configured on this server — admins only
  app.get("/api/backup/status", requireAuth, async (_req, res) => {
    if (!canManageTeam(_req)) return res.status(403).json({ message: "Admin access required" });
    const { isGoogleSheetsAvailable, getServiceAccountEmail } = await import('./googleSheets');
    const available = isGoogleSheetsAvailable();
    const mode = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      ? 'service_account'
      : process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL
      ? 'replit'
      : 'none';
    const serviceAccountEmail = getServiceAccountEmail();
    const driveAvailable = mode === 'service_account';
    res.json({ available, mode, serviceAccountEmail, driveAvailable });
  });

  app.put("/api/teams/:id/backup-sheet", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const url = req.body.url?.trim() || null;
    if (url && !url.includes('docs.google.com/spreadsheets')) {
      return res.status(400).json({ message: "Must be a Google Sheets URL" });
    }
    const updated = await storage.updateTeam(id, { backupSheetUrl: url });
    if (!updated) return res.status(404).json({ message: "Not found" });
    const { startAutoBackup, stopAutoBackup } = await import('./backup');
    if (url) {
      startAutoBackup(id);
    } else {
      stopAutoBackup(id);
    }
    res.json(updated);
  });

  // ── Feedback button (#44) ───────────────────────────────────────────────────
  // Team admins set a Google Sheet link + on/off toggle; the button above the
  // sidebar search opens that sheet for everyone on the team.
  app.get("/api/feedback-button", requireAuth, async (req, res) => {
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const team = await storage.getTeam(teamId);
    res.json({
      enabled: (team as any)?.feedbackEnabled === 1 && !!(team as any)?.feedbackSheetUrl,
      url: (team as any)?.feedbackSheetUrl || null,
    });
  });

  app.put("/api/teams/:id/feedback-settings", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const url = req.body.url?.trim() || null;
    if (url && !url.includes("docs.google.com")) {
      return res.status(400).json({ message: "Must be a Google link" });
    }
    const updated = await storage.updateTeam(id, {
      feedbackSheetUrl: url,
      feedbackEnabled: req.body.enabled ? 1 : 0,
    } as any);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  // ── Kick (#9): classic kick-testing skis + tests ──────────────────────────
  // Group-scope aware list of kick test skis for the active team.
  app.get("/api/kick-skis", requirePermission("kick", "view"), async (req, res) => {
    const u = req.user as any;
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT id, team_id AS "teamId", group_scope AS "groupScope", name, brand, grind, heights,
              type_of_ski AS "typeOfSki", color, notes, archived_at AS "archivedAt",
              created_at AS "createdAt", created_by_id AS "createdById", created_by_name AS "createdByName"
       FROM kick_skis WHERE team_id=$1 AND archived_at IS NULL ORDER BY id DESC`, [teamId]);
    const rows = r.rows.filter((row: any) =>
      userHasGroupAccess(getEffectiveGroupScope(req), isEffectiveAdmin(req), row.groupScope || ""));
    // Child team: parent's kick skis (read-only) so shared kick tests resolve.
    const share = await getParentShare(teamId);
    if (share && share.sharedAreas.includes("kick")) {
      const pr = await (pool as any).query(
        `SELECT id, team_id AS "teamId", group_scope AS "groupScope", name, brand, grind, heights,
                type_of_ski AS "typeOfSki", color, notes, archived_at AS "archivedAt",
                created_at AS "createdAt", created_by_id AS "createdById", created_by_name AS "createdByName"
         FROM kick_skis WHERE team_id=$1 AND archived_at IS NULL ORDER BY id DESC`, [share.parentTeamId]);
      for (const row of pr.rows) rows.push({ ...row, sharedFromTeam: share.parentName, readOnly: true });
    }
    res.json(rows);
  });

  app.post("/api/kick-skis", requirePermission("kick", "edit"), async (req, res) => {
    const u = req.user as any;
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const b = req.body || {};
    const r = await (pool as any).query(
      `INSERT INTO kick_skis (team_id, group_scope, name, brand, grind, heights, type_of_ski, color, notes, created_at, created_by_id, created_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [teamId, resolveCreateGroupScope(req), b.name || null, b.brand || null, b.grind || null,
       b.heights || null, b.typeOfSki || null, b.color || null, b.notes || null, new Date().toISOString(), u.id, u.name]);
    res.json({ id: r.rows[0].id });
  });

  app.put("/api/kick-skis/:id", requirePermission("kick", "edit"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    const b = req.body || {};
    const r = await (pool as any).query(
      `UPDATE kick_skis SET name=$1, brand=$2, grind=$3, heights=$4, type_of_ski=$5, color=$6, notes=$7
       WHERE id=$8 AND team_id=$9 RETURNING id`,
      [b.name || null, b.brand || null, b.grind || null, b.heights || null, b.typeOfSki || null, b.color || null, b.notes || null, id, teamId]);
    if (!r.rows.length) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  app.delete("/api/kick-skis/:id", requirePermission("kick", "edit"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    await (pool as any).query(`UPDATE kick_skis SET archived_at=$1 WHERE id=$2 AND team_id=$3`,
      [new Date().toISOString(), id, teamId]);
    res.json({ ok: true });
  });

  // List kick tests (newest first) with their entries.
  app.get("/api/kick-tests", requirePermission("kick", "view"), async (req, res) => {
    const u = req.user as any;
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const tr = await (pool as any).query(
      `SELECT id, team_id AS "teamId", group_scope AS "groupScope", date, location,
              weather_id AS "weatherId", no_weather AS "noWeather", test_persons AS "testPersons",
              notes, report, created_at AS "createdAt", created_by_name AS "createdByName"
       FROM kick_tests WHERE team_id=$1 ORDER BY date DESC, id DESC`, [teamId]);
    const tests = tr.rows.filter((row: any) =>
      userHasGroupAccess(u.groupScope, isEffectiveAdmin(req), row.groupScope || ""));
    const ids = tests.map((t: any) => t.id);
    let entries: any[] = [];
    if (ids.length) {
      const er = await (pool as any).query(
        `SELECT id, kick_test_id AS "kickTestId", kick_ski_id AS "kickSkiId", binder,
                kick_solution AS "kickSolution", feeling_rank AS "feelingRank", feeling_notes AS "feelingNotes"
         FROM kick_test_entries WHERE kick_test_id = ANY($1::int[])`, [ids]);
      entries = er.rows;
    }
    for (const t of tests) t.entries = entries.filter((e) => e.kickTestId === t.id);
    // Child team: append the parent's kick tests (read-only).
    const share = await getParentShare(teamId);
    if (share && share.sharedAreas.includes("kick")) {
      const ptr = await (pool as any).query(
        `SELECT id, team_id AS "teamId", group_scope AS "groupScope", date, location,
                weather_id AS "weatherId", no_weather AS "noWeather", test_persons AS "testPersons",
                notes, report, created_at AS "createdAt", created_by_name AS "createdByName"
         FROM kick_tests WHERE team_id=$1 ORDER BY date DESC, id DESC`, [share.parentTeamId]);
      const pids = ptr.rows.map((t: any) => t.id);
      let pEntries: any[] = [];
      if (pids.length) {
        const per = await (pool as any).query(
          `SELECT id, kick_test_id AS "kickTestId", kick_ski_id AS "kickSkiId", binder,
                  kick_solution AS "kickSolution", feeling_rank AS "feelingRank", feeling_notes AS "feelingNotes"
           FROM kick_test_entries WHERE kick_test_id = ANY($1::int[])`, [pids]);
        pEntries = per.rows;
      }
      for (const t of ptr.rows) {
        t.entries = pEntries.filter((e: any) => e.kickTestId === t.id);
        t.sharedFromTeam = share.parentName;
        t.readOnly = true;
        tests.push(t);
      }
    }
    res.json(tests);
  });

  app.post("/api/kick-tests", requirePermission("kick", "edit"), async (req, res) => {
    const u = req.user as any;
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const b = req.body || {};
    const tr = await (pool as any).query(
      `INSERT INTO kick_tests (team_id, group_scope, date, location, weather_id, no_weather, test_persons, notes, report, created_at, created_by_id, created_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [teamId, resolveCreateGroupScope(req), b.date || new Date().toISOString().split("T")[0],
       b.location || null, b.noWeather ? null : (b.weatherId || null), b.noWeather ? 1 : 0,
       b.testPersons || null, b.notes || null, b.report || null, new Date().toISOString(), u.id, u.name]);
    const id = tr.rows[0].id;
    for (const e of (b.entries || [])) {
      await (pool as any).query(
        `INSERT INTO kick_test_entries (kick_test_id, kick_ski_id, binder, kick_solution, feeling_rank, feeling_notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, e.kickSkiId, e.binder || null, e.kickSolution || null, e.feelingRank ?? null, e.feelingNotes || null]);
    }
    res.json({ id });
  });

  app.put("/api/kick-tests/:id", requirePermission("kick", "edit"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    const b = req.body || {};
    const r = await (pool as any).query(
      `UPDATE kick_tests SET date=$1, location=$2, weather_id=$3, no_weather=$4, test_persons=$5, notes=$6, report=$7
       WHERE id=$8 AND team_id=$9 RETURNING id`,
      [b.date, b.location || null, b.noWeather ? null : (b.weatherId || null), b.noWeather ? 1 : 0,
       b.testPersons || null, b.notes || null, b.report || null, id, teamId]);
    if (!r.rows.length) return res.status(404).json({ message: "Not found" });
    if (Array.isArray(b.entries)) {
      await (pool as any).query(`DELETE FROM kick_test_entries WHERE kick_test_id=$1`, [id]);
      for (const e of b.entries) {
        await (pool as any).query(
          `INSERT INTO kick_test_entries (kick_test_id, kick_ski_id, binder, kick_solution, feeling_rank, feeling_notes)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, e.kickSkiId, e.binder || null, e.kickSolution || null, e.feelingRank ?? null, e.feelingNotes || null]);
      }
    }
    res.json({ ok: true });
  });

  app.delete("/api/kick-tests/:id", requirePermission("kick", "edit"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    // Recycle bin: snapshot the test + entries before they disappear.
    const snapT = await (pool as any).query(`SELECT * FROM kick_tests WHERE id=$1 AND team_id=$2`, [id, teamId]);
    const snapE = await (pool as any).query(`SELECT * FROM kick_test_entries WHERE kick_test_id=$1`, [id]);
    const r = await (pool as any).query(`DELETE FROM kick_tests WHERE id=$1 AND team_id=$2 RETURNING id`, [id, teamId]);
    if (r.rows.length) {
      await (pool as any).query(`DELETE FROM kick_test_entries WHERE kick_test_id=$1`, [id]);
      await recordDeletion(req, "kick_test", id, `Kick test deleted: ${snapT.rows[0]?.location ?? id} (${snapT.rows[0]?.date ?? ""})`, { test: snapT.rows[0] ?? null, entries: snapE.rows });
    }
    res.json({ ok: true });
  });

  // ── Kick mixes: recipes for blended kick products ──────────────────────────
  app.get("/api/kick-mixes", requirePermission("kick", "view"), async (req, res) => {
    const u = req.user as any;
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT km.id, km.team_id AS "teamId", km.group_scope AS "groupScope", km.name, km.mix_type AS "mixType",
              km.roller_temperature AS "rollerTemperature", km.products, km.notes,
              km.created_at AS "createdAt", km.created_by_name AS "createdByName",
              km.product_id AS "productId", p.serial_number AS "serialNumber"
       FROM kick_mixes km LEFT JOIN products p ON p.id = km.product_id
       WHERE km.team_id=$1 ORDER BY km.id DESC`, [teamId]);
    const rows = r.rows.filter((row: any) =>
      userHasGroupAccess(getEffectiveGroupScope(req), isEffectiveAdmin(req), row.groupScope || ""));
    // Child team: parent's kick mixes (read-only).
    const shareMix = await getParentShare(teamId);
    if (shareMix && shareMix.sharedAreas.includes("kick")) {
      const pr = await (pool as any).query(
        `SELECT id, team_id AS "teamId", group_scope AS "groupScope", name, mix_type AS "mixType",
                roller_temperature AS "rollerTemperature", products, notes,
                created_at AS "createdAt", created_by_name AS "createdByName"
         FROM kick_mixes WHERE team_id=$1 ORDER BY id DESC`, [shareMix.parentTeamId]);
      for (const row of pr.rows) rows.push({ ...row, sharedFromTeam: shareMix.parentName, readOnly: true });
    }
    res.json(rows);
  });

  app.post("/api/kick-mixes", requirePermission("kick", "edit"), async (req, res) => {
    const u = req.user as any;
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const b = req.body || {};
    const products = Array.isArray(b.products) ? JSON.stringify(b.products) : null;
    const r = await (pool as any).query(
      `INSERT INTO kick_mixes (team_id, group_scope, name, mix_type, roller_temperature, products, notes, created_at, created_by_id, created_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [teamId, resolveCreateGroupScope(req), b.name || "", b.mixType === "klister" ? "klister" : "hardwax",
       b.mixType === "klister" ? (b.rollerTemperature || null) : null, products, b.notes || null,
       new Date().toISOString(), u.id, u.name]);
    // Kick mixes are products too: 700-series serial, searchable, analysable.
    let serialOut: string | null = null;
    try {
      serialOut = await nextMixSerial(teamId, "kick");
      if (serialOut) {
        const prod = await storage.createProduct({
          category: "Kick", brand: "Mix", name: b.name || "",
          serialNumber: serialOut, isMix: 1,
          recipe: JSON.stringify({ kind: "kick", components: Array.isArray(b.products) ? b.products : [], notes: b.notes || null }),
          createdAt: new Date().toISOString(), createdById: (u as any).id, createdByName: (u as any).name,
          groupScope: resolveCreateGroupScope(req), teamId,
        } as any);
        await (pool as any).query(`UPDATE kick_mixes SET product_id = $1 WHERE id = $2`, [prod.id, r.rows[0].id]);
      }
    } catch (e) { console.error("[kick-mix] product link failed:", e); }
    res.json({ id: r.rows[0].id, serialNumber: serialOut });
  });

  app.put("/api/kick-mixes/:id", requirePermission("kick", "edit"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    const b = req.body || {};
    const products = Array.isArray(b.products) ? JSON.stringify(b.products) : null;
    const r = await (pool as any).query(
      `UPDATE kick_mixes SET name=$1, mix_type=$2, roller_temperature=$3, products=$4, notes=$5
       WHERE id=$6 AND team_id=$7 RETURNING id`,
      [b.name || "", b.mixType === "klister" ? "klister" : "hardwax",
       b.mixType === "klister" ? (b.rollerTemperature || null) : null, products, b.notes || null, id, teamId]);
    if (!r.rows.length) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  app.delete("/api/kick-mixes/:id", requirePermission("kick", "edit"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    const snap = await (pool as any).query(`SELECT * FROM kick_mixes WHERE id=$1 AND team_id=$2`, [id, teamId]);
    const r = await (pool as any).query(`DELETE FROM kick_mixes WHERE id=$1 AND team_id=$2 RETURNING id`, [id, teamId]);
    if (r.rows.length) await recordDeletion(req, "kick_mix", id, `Kick mix deleted: ${snap.rows[0]?.name ?? id}`, snap.rows[0] ?? null);
    res.json({ ok: true });
  });

  // ── Product import from Google Sheet ───────────────────────────────────────
  // Connect a Google Sheet of products. Sync is ADDITIVE — new rows become
  // products; nothing is ever deleted from Glidr when removed from the sheet.
  app.put("/api/teams/:id/product-sheet", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const url = req.body.url?.trim() || null;
    if (url && !url.includes('docs.google.com/spreadsheets')) {
      return res.status(400).json({ message: "Must be a Google Sheets URL" });
    }
    // Remember the group the sheet is connected from so imports land there.
    const importGroup = url ? resolveCreateGroupScope(req) : null;
    const updated = await storage.updateTeam(id, { productSheetUrl: url, productSheetGroup: importGroup } as any);
    if (!updated) return res.status(404).json({ message: "Not found" });
    const { startAutoProductSync, stopAutoProductSync, syncProductsFromSheet } = await import('./productSync');
    if (url) {
      // Run an immediate sync, then keep it auto-syncing every 5 minutes.
      syncProductsFromSheet(id, importGroup || undefined).catch(() => {});
      startAutoProductSync(id);
    } else {
      stopAutoProductSync(id);
    }
    res.json(updated);
  });

  app.post("/api/teams/:id/product-sync", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { isGoogleSheetsAvailable } = await import('./googleSheets');
    if (!isGoogleSheetsAvailable()) {
      return res.status(400).json({ message: "Google Sheets is not configured on this server." });
    }
    const { syncProductsFromSheet } = await import('./productSync');
    // Use the group the sheet was connected from; fall back to the requester's group.
    const team = await storage.getTeam(id);
    const group = (team as any)?.productSheetGroup || resolveCreateGroupScope(req);
    const result = await syncProductsFromSheet(id, group);
    if (!result.success) return res.status(400).json({ message: result.error || "Sync failed" });
    res.json(result);
  });

  // ── Google Drive backup folder ─────────────────────────────────────────────
  app.put("/api/teams/:id/drive-folder", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const raw = req.body.url?.trim() || null;
    let folderId: string | null = null;
    if (raw) {
      // Accept full URL or bare ID
      const m = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      folderId = m ? m[1] : raw;
    }
    // Reset file IDs so they are recreated in the new folder
    const updated = await storage.updateTeam(id, {
      driveFolderId: folderId,
      driveJsonFileId: null,
      drivePdfFileId: null,
    } as any);
    if (!updated) return res.status(404).json({ message: "Not found" });
    // Kick the auto-backup scheduler so the daily JSON+PDF backup starts without a
    // restart. A Drive folder link alone is enough (no Sheets URL required).
    try {
      const { startAutoBackup, stopAutoBackup } = await import('./backup');
      if (folderId || updated.backupSheetUrl) startAutoBackup(id);
      else stopAutoBackup(id);
    } catch (e) { console.error('[DriveBackup] scheduler restart failed:', e); }
    res.json(updated);
  });

  app.post("/api/teams/:id/drive-backup", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { runDriveBackupForTeam } = await import('./backup');
    const result = await runDriveBackupForTeam(id, { force: true });
    if (result.success) {
      res.json({ ok: true, pdfError: result.pdfError ?? null });
    } else {
      res.status(500).json({ message: result.error || 'Drive backup failed' });
    }
  });

  app.put("/api/teams/:id/logo", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const u = req.user!;
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { logo } = req.body; // base64 data URL or null to remove
    if (logo && typeof logo === "string") {
      // Validate it's a base64 image
      if (!logo.startsWith("data:image/")) {
        return res.status(400).json({ error: "Must be a valid image data URL" });
      }
      // Rough size check: base64 is ~4/3 of original, cap at ~150KB
      if (logo.length > 200000) {
        return res.status(400).json({ error: "Logo must be under 150KB" });
      }
    }
    const updated = await storage.updateTeam(id, { teamLogo: logo || null });
    res.json(updated);
  });

  // ── Download JSON export ──────────────────────────────────────────────────
  // Complete JSON backup via the auto-discovering export engine.
  //   ?teamScope=<id> / (TA: own team)  → complete team export
  //   ?teamScope=all (SA only)          → complete FULL-SYSTEM export, every team
  app.get("/api/admin/export-json", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getAdminTeamScope(req);
    const { buildTeamJsonExport, buildSystemJsonExport } = await import('./backup');
    try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "exported_full_data",
        entityType: "team", entityId: teamId ?? 0,
        details: teamId == null ? "Full SYSTEM export (JSON, all teams)" : "Complete team export (JSON)",
        createdAt: new Date().toISOString(), groupScope: u.groupScope.split(",")[0]?.trim() ?? "", teamId: teamId ?? getActiveTeamId(req),
      } as any);
    } catch (_) {}
    // Optional ?areas=tests,kick,… — filters the export to the checked data
    // areas; tables no area claims (teams/settings) are always included.
    const areas = typeof req.query.areas === "string" && req.query.areas.trim() !== ""
      ? String(req.query.areas).split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    let json: string; let filename: string;
    if (teamId == null) {
      if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
      json = await buildSystemJsonExport(areas);
      filename = `glidr-system-backup-${new Date().toISOString().slice(0, 10)}.json`;
    } else {
      json = await buildTeamJsonExport(teamId, u.isAdmin, areas);
      filename = `glidr-team-${teamId}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(json);
  });

  // ── System disaster-recovery dump (SA only) ──────────────────────────────
  // RAW nightly full-database snapshot to the SA's private Drive folder.
  const getDumpSetting = async (key: string): Promise<string | null> => {
    try {
      const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = ${key}`);
      return (((rows as any).rows ?? rows)[0]?.value as string) ?? null;
    } catch { return null; }
  };
  app.get("/api/admin/system-dump", requireAuth, async (req, res) => {
    if ((req.user as any).isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    res.json({
      folderId: await getDumpSetting("system_dump_folder_id"),
      lastAt: await getDumpSetting("system_dump_last_at"),
      lastError: (await getDumpSetting("system_dump_last_error")) || null,
    });
  });
  app.post("/api/admin/system-dump/settings", requireAuth, async (req, res) => {
    if ((req.user as any).isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const folderId = String(req.body.folderId ?? "").trim();
    await db.execute(sql`
      INSERT INTO app_settings (key, value) VALUES ('system_dump_folder_id', ${folderId})
      ON CONFLICT (key) DO UPDATE SET value = ${folderId}
    `);
    res.json({ ok: true });
  });
  app.post("/api/admin/system-dump/run", requireAuth, async (req, res) => {
    if ((req.user as any).isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const { runSystemDump } = await import("./backup");
    const result = await runSystemDump();
    res.status(result.success ? 200 : 500).json(result);
  });

  app.get("/api/teams/:id/export-json", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const team = await storage.getTeam(id);
    if (!team) return res.status(404).json({ message: "Not found" });
    const { buildTeamJsonExport } = await import('./backup');
    const json = await buildTeamJsonExport(id, u.isAdmin === 1);
    const filename = `glidr-${team.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-data.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(json);
  });

  // ── Download full data PDF (same as admin "Download PDF" button) ─────────
  app.get("/api/teams/:id/export-pdf", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const team = await storage.getTeam(id);
    if (!team) return res.status(404).json({ message: "Team not found" });
    try {
      const { buildTeamPdfBuffer } = await import('./backup');
      const pdfBuffer = await buildTeamPdfBuffer(id);
      const filename = `glidr-${team.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-data.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error('[ExportPDF]', err);
      res.status(500).json({ message: err.message || 'PDF generation failed' });
    }
  });

  app.post("/api/teams/:id/backup", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { isGoogleSheetsAvailable } = await import('./googleSheets');
    if (!isGoogleSheetsAvailable()) {
      return res.status(503).json({
        message:
          "Google Sheets backup is not configured. Set the GOOGLE_SERVICE_ACCOUNT_JSON environment variable in your Render dashboard.",
      });
    }
    const team = await storage.getTeam(id);
    if (!team) return res.status(404).json({ message: "Team not found" });
    if (!team.backupSheetUrl) return res.status(400).json({ message: "No backup sheet URL configured" });
    const { runBackupForTeam } = await import('./backup');
    // Manual run = deliberate → bypasses the data-loss guard.
    const result = await runBackupForTeam(id, { force: true });
    if (result.success) {
      res.json({ ok: true, lastBackupAt: new Date().toISOString() });
    } else {
      res.status(500).json({ message: result.error || "Backup failed" });
    }
  });

  app.post("/api/teams/switch", requireAuth, async (req, res) => {
    const u = req.user!;
    const teamId = parseInt(req.body.teamId);
    if (!teamId) return res.status(400).json({ message: "teamId required" });
    const team = await storage.getTeam(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Super admins can switch to any team; regular users can only switch to their
    // own teams — plus TAs of a PARENT team may enter its child teams.
    const isParentTa = u.isAdmin !== 1 && u.isTeamAdmin === 1 && (team as any).parentTeamId === u.teamId;
    if (u.isAdmin !== 1 && !isParentTa) {
      const memberships = await storage.getUserTeams(u.id);
      const allowed = memberships.map((m) => m.teamId);
      // Also always allow their primary teamId
      if (!allowed.includes(u.teamId)) allowed.push(u.teamId);
      if (!allowed.includes(teamId)) {
        return res.status(403).json({ message: "You do not belong to that team" });
      }
    }

    await storage.updateUser(u.id, { activeTeamId: teamId } as any);

    // Clear stealth when switching to primary team OR any team the user is explicitly a member of
    const memberships = await storage.getUserTeams(u.id);
    const isExplicitMember = teamId === u.teamId || memberships.some(m => m.teamId === teamId);
    if (isExplicitMember && (req.session as any).stealth) {
      (req.session as any).stealth = false;
      const prev = (req.session as any).incognitoBeforeStealth;
      (req.session as any).incognito = !!prev;
      delete (req.session as any).incognitoBeforeStealth;
    }

    // Access-transparency log ("innsynslogg"): when a Super Admin enters a team,
    // the visit is recorded in THAT team's activity log — visible to the team's
    // admins. SAs are never team members, so this applies to EVERY team they
    // enter. ALWAYS logged, including stealth and incognito: trust through
    // transparency, never silent access. Throttled to one entry per SA+team per
    // hour so repeated switching doesn't spam.
    if (u.isAdmin === 1) {
      try {
        const { pool: pAcc } = await import("./db");
        const recent = await (pAcc as any).query(
          `SELECT id FROM activity_logs WHERE action = 'sa_access' AND user_id = $1 AND team_id = $2 AND created_at >= $3 LIMIT 1`,
          [u.id, teamId, new Date(Date.now() - 3600000).toISOString()]
        );
        if (recent.rows.length === 0) {
          await storage.createActivityLog({
            userId: u.id, userName: u.name, action: "sa_access",
            entityType: "team", entityId: teamId,
            details: "Glidr support (Super Admin) accessed this team's workspace",
            createdAt: new Date().toISOString(), groupScope: "", teamId,
          } as any);
        }
      } catch (e) { console.error("[access-log] failed:", e); }
    }

    // Parent-team TAs administer child teams like SA does — not listed as
    // members, but every visit is recorded in the CHILD team's activity log.
    if (isParentTa) {
      (req.session as any).effectivePermissions = null;
      (req.session as any).effectiveGroupScope = "";
      (req.session as any).activeTeamIsAdmin = true;
      try {
        const { pool: pAcc2 } = await import("./db");
        const recent = await (pAcc2 as any).query(
          `SELECT id FROM activity_logs WHERE action = 'parent_access' AND user_id = $1 AND team_id = $2 AND created_at >= $3 LIMIT 1`,
          [u.id, teamId, new Date(Date.now() - 3600000).toISOString()]
        );
        if (recent.rows.length === 0) {
          const parentTeam = await storage.getTeam(u.teamId);
          await storage.createActivityLog({
            userId: u.id, userName: u.name, action: "parent_access",
            entityType: "team", entityId: teamId,
            details: `${parentTeam?.name ?? "Parent team"} (moderlag) accessed this team's workspace`,
            createdAt: new Date().toISOString(), groupScope: "", teamId,
          } as any);
        }
      } catch (e) { console.error("[parent-access-log] failed:", e); }
      return req.session.save(() => res.json({ ok: true }));
    }

    // Resolve per-team permissions, group scope and TA status for the team we
    // just entered (same resolver the refresh middleware uses).
    (req.user as any).activeTeamId = teamId;
    (req.session as any).perTeamResolvedFor = null;
    await refreshPerTeamAccess(req);

    req.session.save(() => {
      res.json({ ok: true });
    });
  });

  // Get all teams the current user belongs to
  app.get("/api/user/teams", requireAuth, async (req, res) => {
    const u = req.user!;
    const memberships = await storage.getUserTeams(u.id);
    const teamIds = [...new Set([u.teamId, ...memberships.map((m) => m.teamId)])];
    const allTeams = await storage.listTeams();
    const userTeams = allTeams.filter((t) => teamIds.includes(t.id));
    // Parent-team TAs also get their child teams in the switcher.
    if (u.isTeamAdmin === 1) {
      for (const t of allTeams) {
        if ((t as any).parentTeamId === u.teamId && !teamIds.includes(t.id)) userTeams.push(t);
      }
    }
    res.json(userTeams);
  });

  // Admin: add a user to a team
  app.post("/api/users/:id/teams", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const teamId = parseInt(req.body.teamId);
    if (!teamId) return res.status(400).json({ message: "teamId required" });
    if ((req.user as any).isAdmin !== 1 && teamId !== getActiveTeamId(req)) {
      return res.status(403).json({ message: "Cannot manage other teams" });
    }
    const team = await storage.getTeam(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });
    const targetUser = await storage.getUser(userId);
    if ((targetUser as any)?.isAdmin === 1) {
      return res.status(400).json({ message: "Super Admins already have access to every team" });
    }
    await storage.addUserToTeam(userId, teamId);
    res.json({ ok: true });
  });

  // Admin: remove a user from a team
  app.delete("/api/users/:id/teams/:teamId", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const teamId = parseInt(req.params.teamId);
    const u = req.user!;
    // Non-SA admins may only manage their own active team.
    if (u.isAdmin !== 1 && teamId !== getActiveTeamId(req)) return res.status(403).json({ message: "Cannot manage other teams" });
    await storage.removeUserFromTeam(userId, teamId);
    const { pool: p2 } = await import("./db");
    // Also drop any per-team role/permission override so the revoke is complete
    // (otherwise the user would still appear in the team's Users list).
    await (p2 as any).query(`DELETE FROM user_team_permissions WHERE user_id = $1 AND team_id = $2`, [userId, teamId]);
    // Reset activeTeamId if the user was currently viewing the removed team
    // This prevents them from being stuck on a team they no longer have access to
    await (p2 as any).query(
      `UPDATE users SET active_team_id = NULL WHERE id = $1 AND active_team_id = $2`,
      [userId, teamId]
    );
    res.json({ ok: true });
  });

  // Admin: list teams for a user
  app.get("/api/users/:id/teams", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const memberships = await storage.getUserTeams(userId);
    res.json(memberships);
  });

  app.get("/api/groups", requireAuth, async (req, res) => {
    const teamId = canManageTeam(req) ? getAdminTeamScope(req) : getActiveTeamId(req);
    const list = await storage.listGroups(teamId);
    res.json(list);
  });

  app.post("/api/groups", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const u = req.user!;
    const teamId = u.isAdmin === 1 && req.body.teamId ? req.body.teamId : getActiveTeamId(req);
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    const groupLimit = await checkTeamLimit(teamId, "groups");
    if (!groupLimit.allowed) return res.status(403).json({ message: `Team has reached the group limit (${groupLimit.limit}).` });
    try {
      const created = await storage.createGroup({ name, teamId });
      res.json(created);
    } catch (e: any) {
      if (e.code === "23505") return res.status(409).json({ message: "Group already exists" });
      throw e;
    }
  });

  app.put("/api/groups/:id", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    // Team boundary: a TA may only rename groups in their ACTIVE team.
    const { pool: pGrp } = await import("./db");
    const grpRes = await (pGrp as any).query(`SELECT team_id FROM groups WHERE id = $1`, [id]);
    if (!grpRes.rows.length) return res.status(404).json({ message: "Not found" });
    if ((req.user as any).isAdmin !== 1 && grpRes.rows[0].team_id !== getActiveTeamId(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const updated = await storage.updateGroup(id, { name });
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e: any) {
      if (e.code === "23505") return res.status(409).json({ message: "Group already exists" });
      throw e;
    }
  });

  app.delete("/api/groups/:id", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const { pool: pGrp } = await import("./db");
    const snap = await (pGrp as any).query(`SELECT * FROM groups WHERE id=$1`, [id]);
    if (snap.rows.length === 0) return res.status(404).json({ message: "Not found" });
    if ((req.user as any).isAdmin !== 1 && snap.rows[0].team_id !== getActiveTeamId(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const deleted = await storage.deleteGroup(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    await recordDeletion(req, "group", id, `Group deleted: ${snap.rows[0]?.name ?? id}`, snap.rows[0] ?? null);
    res.json({ ok: true });
  });

  // Everything waiting for someone, in one query. These facts already exist,
  // but scattered across five pages — so nobody sees them until they go looking.
  // Distinct products actually used in the team's tests (main + additional),
  // derived live so deleted tests fall out of the number immediately.
  app.get("/api/dashboard/products-tested", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    if (!teamId) return res.json({ count: 0, brands: 0 });
    try {
      const { pool: pgPT } = await import("./db");
      const r = await (pgPT as any).query(
        `SELECT te.product_id, te.additional_product_ids
         FROM test_entries te JOIN tests t ON t.id = te.test_id
         WHERE t.team_id = $1 AND (te.product_id IS NOT NULL OR te.additional_product_ids IS NOT NULL)`,
        [teamId]);
      const ids = new Set<number>();
      for (const row of r.rows) {
        if (row.product_id != null) ids.add(row.product_id);
        if (row.additional_product_ids) {
          for (const part of String(row.additional_product_ids).split(",")) {
            const n = parseInt(part);
            if (!isNaN(n) && n > 0) ids.add(n);
          }
        }
      }
      let brands = 0;
      if (ids.size > 0) {
        const br = await (pgPT as any).query(
          `SELECT COUNT(DISTINCT brand)::int AS c FROM products WHERE id = ANY($1::int[]) AND brand IS NOT NULL`,
          [Array.from(ids)]);
        brands = br.rows[0]?.c || 0;
      }
      res.json({ count: ids.size, brands });
    } catch (e) {
      console.error("[products-tested]", e);
      res.json({ count: 0, brands: 0 });
    }
  });

  app.get("/api/dashboard/attention", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    if (!teamId) return res.json({ items: [] });
    const { pool: pgA } = await import("./db");
    const items: { key: string; count: number; href: string; severity: "warn" | "info" }[] = [];
    const one = async (sql: string, params: any[]) => {
      try { return (await (pgA as any).query(sql, params)).rows[0]?.n ?? 0; } catch { return 0; }
    };
    // Only surface what this user could actually open — a prompt to fix
    // something they cannot reach is just noise.
    const u = req.user!;
    const perms = parsePermissions(getEffectivePermissionsStr(req), u.isAdmin === 1, getEffectiveIsTeamAdmin(req));
    const may = (area: string) => (perms as any)[area] && (perms as any)[area] !== "none";

    // Weather is what makes a test reusable later; a test without it decays
    // into an anecdote. Only recent ones — old gaps can no longer be filled.
    const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    // Count over the SAME set of tests the user's Tests page can show — the
    // whole team for a scope admin, the user's groups otherwise. A chip that
    // promises 13 while the page can only show 1 is worse than no chip.
    const uInfo = userInfo(req);
    const visibleTests: any[] = uInfo.isScopeAdmin
      ? await storage.listAllTestsForTeam(teamId)
      : await storage.listTests(uInfo.groupScope, false, teamId);
    const recent = visibleTests.filter((t: any) => t.date >= since);
    const isAthleteTest = (t: any) => t.testSkiSource === "raceskis";
    const noWx = (t: any) => t.weatherId == null && !(t as any).noWeather;

    const missingWeather = recent.filter((t) => !isAthleteTest(t) && noWx(t)).length;
    if (missingWeather && may("tests")) items.push({ key: "missingWeather", count: missingWeather, href: "/tests?attention=missing-weather", severity: "warn" });
    const missingWeatherAthlete = recent.filter((t) => isAthleteTest(t) && noWx(t)).length;
    if (missingWeatherAthlete && may("raceskis")) items.push({ key: "missingWeatherAthlete", count: missingWeatherAthlete, href: "/tests?attention=missing-weather&scope=athletes", severity: "warn" });

    const needRegrind = await one(
      `SELECT COUNT(*)::int AS n FROM test_ski_series
       WHERE team_id = $1 AND archived_at IS NULL AND action_status = 'Need regrind'`, [teamId]);
    if (needRegrind && may("testskis")) items.push({ key: "needRegrind", count: needRegrind, href: "/testskis", severity: "warn" });

    const outOfStock = await one(
      `SELECT COUNT(*)::int AS n FROM products
       WHERE team_id = $1 AND archived_at IS NULL AND stock_quantity <= 0 AND order_quantity <= 0`, [teamId]);
    if (outOfStock && may("products")) items.push({ key: "outOfStock", count: outOfStock, href: "/products", severity: "warn" });

    const onOrder = await one(
      `SELECT COUNT(*)::int AS n FROM products
       WHERE team_id = $1 AND archived_at IS NULL AND order_quantity > 0`, [teamId]);
    if (onOrder && may("products")) items.push({ key: "onOrder", count: onOrder, href: "/products", severity: "info" });

    // Tests that were set up but never got results — easy to forget after a
    // travel day, and worthless until someone enters the numbers.
    // Same visibility rule for the no-results counts, restricted to ids the
    // user can actually open.
    const recentIds = recent.map((t: any) => t.id);
    const noResSet = new Set<number>();
    if (recentIds.length) {
      try {
        const r = await (pgA as any).query(
          `SELECT t.id FROM tests t
           WHERE t.id = ANY($1::int[])
             AND EXISTS (SELECT 1 FROM test_entries e WHERE e.test_id = t.id)
             AND NOT EXISTS (SELECT 1 FROM test_entries e WHERE e.test_id = t.id
                             AND (e.result_0km_cm_behind IS NOT NULL OR e.rank_0km IS NOT NULL))`,
          [recentIds]);
        for (const row of r.rows) noResSet.add(row.id);
      } catch (e) { console.error("[attention] no-results failed:", e); }
    }
    const noResults = recent.filter((t) => !isAthleteTest(t) && noResSet.has(t.id)).length;
    if (noResults && may("tests")) items.push({ key: "noResults", count: noResults, href: "/tests?attention=no-results", severity: "warn" });
    const noResultsAthlete = recent.filter((t) => isAthleteTest(t) && noResSet.has(t.id)).length;
    if (noResultsAthlete && may("raceskis")) items.push({ key: "noResultsAthlete", count: noResultsAthlete, href: "/tests?attention=no-results&scope=athletes", severity: "warn" });

    if (canManageTeam(req)) {
      const joins = await one(
        `SELECT COUNT(*)::int AS n FROM team_join_requests WHERE team_id = $1 AND status = 'pending'`, [teamId]);
      if (joins) items.push({ key: "joinRequests", count: joins, href: "/my-team", severity: "info" });
    }

    res.json({ items });
  });

  app.get("/api/series", requirePermission("testskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listSeries(u.groupScope, u.isScopeAdmin, teamId);
    // How much each fleet has actually been used. Without it the list cannot
    // answer the two questions you ask of it: which fleet is worn out, and
    // which one has been standing unused since autumn.
    const ids = list.map((x: any) => x.id).filter(Boolean);
    if (ids.length) {
      try {
        const { pool: pgS } = await import("./db");
        const r = await (pgS as any).query(
          `SELECT series_id AS id, COUNT(*)::int AS n, MAX(date) AS last
           FROM tests WHERE series_id = ANY($1::int[]) AND team_id = $2 GROUP BY series_id`,
          [ids, teamId]);
        const m = new Map(r.rows.map((x: any) => [x.id, x]));
        for (const row of list as any[]) {
          const a = m.get(row.id) as any;
          row.testCount = a?.n ?? 0;
          row.lastTestDate = a?.last ?? null;
        }
      } catch (e) { console.error("[series] usage counts failed:", e); }
    }
    res.json(list);
  });

  app.post("/api/series", requirePermission("testskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const now = new Date().toISOString();
    const groupScope = resolveCreateGroupScope(req);
    const result = await storage.createSeries({
      name: req.body.name,
      type: req.body.type,
      brand: req.body.brand?.trim() || null,
      skiType: req.body.skiType?.trim() || null,
      grind: req.body.grind || null,
      numberOfSkis: req.body.numberOfSkis ?? 8,
      pairLabels: req.body.pairLabels || null,
      lastRegrind: req.body.lastRegrind || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "series", entityId: result.id,
        details: `Series: ${result.name}`, createdAt: new Date().toISOString(), groupScope, teamId,
      });
    } catch (_) {}
    res.json(result);
  });

  app.put("/api/series/:id", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const data: any = {
      name: req.body.name,
      type: req.body.type,
      grind: req.body.grind || null,
      numberOfSkis: req.body.numberOfSkis,
      pairLabels: req.body.pairLabels !== undefined ? (req.body.pairLabels || null) : undefined,
      lastRegrind: req.body.lastRegrind || null,
    };
    if (data.pairLabels === undefined) delete data.pairLabels;
    if (req.body.brand !== undefined) data.brand = req.body.brand;
    if (req.body.skiType !== undefined) data.skiType = req.body.skiType;
    if (req.body.groupScope) data.groupScope = req.body.groupScope;
    const updated = await storage.updateSeries(id, data);
    await stampEdit("test_ski_series", id, req);
    res.json(updated);
  });

  // #28: quick action-status update for a series (Need regrind / In for regrind / Grinded / In use).
  app.patch("/api/series/:id/action", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateSeries(id, {
      actionStatus: req.body.actionStatus || null,
      actionLocation: req.body.actionLocation || null,
    } as any);
    await stampEdit("test_ski_series", id, req);
    res.json(updated);
  });

  app.get("/api/series/archived", requirePermission("testskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listArchivedSeries(u.groupScope, u.isScopeAdmin, teamId);
    res.json(list);
  });

  app.post("/api/series/:id/archive", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.archiveSeries(id);
    res.json(updated);
  });

  app.post("/api/series/:id/restore", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.restoreSeries(id);
    res.json(updated);
  });

  app.delete("/api/series/:id", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!existing.archivedAt) {
      return res.status(400).json({ message: "Series must be archived before permanent deletion" });
    }
    await storage.deleteSeries(id);
    res.json({ ok: true });
  });

  app.get("/api/products", requirePermission("products", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list: any[] = await storage.listProducts(u.groupScope, u.isScopeAdmin, teamId);
    // Child team: append the parent's shared products (read-only, curated).
    const share = await getParentShare(teamId);
    if (share && share.sharedAreas.includes("products")) {
      const excl = await getChildExclusions(share.parentTeamId);
      const parentList = await storage.listProducts("", true, share.parentTeamId);
      for (const p of parentList) {
        if (excl.products.has(p.id)) continue;
        list.push({ ...p, sharedFromTeam: share.parentName, readOnly: true });
      }
    }
    res.json(list);
  });

  // Create a GLIDE MIX: a real product with a per-team 3-digit serial and the
  // recipe stored on it — selectable in tests, full history/analytics for free.
  app.post("/api/glide-mixes", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    const kind = ["powder", "liquid", "solid", "other"].includes(req.body.mixKind) ? req.body.mixKind : "other";
    const serial = await nextMixSerial(teamId, kind);
    if (!serial) return res.status(409).json({ message: "No free serial numbers left in this range" });
    const components = Array.isArray(req.body.components)
      ? req.body.components
          .map((c: any) => ({
            productId: c.productId != null ? parseInt(String(c.productId)) : null,
            freeText: c.freeText ? String(c.freeText) : null,
            note: c.note ? String(c.note) : null,
          }))
          .filter((c: any) => c.productId != null || c.freeText)
      : [];
    const created = await storage.createProduct({
      category: MIX_KIND_CATEGORY[kind],
      brand: "Mix",
      name,
      serialNumber: serial,
      isMix: 1,
      recipe: JSON.stringify({ kind, components, notes: req.body.notes || null }),
      createdAt: new Date().toISOString(),
      createdById: u.id,
      createdByName: u.name,
      groupScope: resolveCreateGroupScope(req),
      teamId,
    } as any);
    try {
      const { schedulePushProductToSheet } = await import("./productSync");
      schedulePushProductToSheet(teamId, (created as any).id);
    } catch {}
    res.json({ ...created, serialNumber: serial });
  });

  app.post("/api/products", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const productLimit = await checkTeamLimit(teamId, "products");
    if (!productLimit.allowed) return res.status(403).json({ message: `Team has reached the product limit (${productLimit.limit}).` });
    const now = new Date().toISOString();
    const groupScope = resolveCreateGroupScope(req);
    const result = await storage.createProduct({
      category: req.body.category,
      brand: req.body.brand.trim(),
      name: req.body.name.trim(),
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "product", entityId: result.id,
        details: `Product: ${result.brand} ${result.name}`, createdAt: new Date().toISOString(), groupScope, teamId,
      });
    } catch (_) {}
    // New products created in Glidr are appended to the linked product sheet
    // following the sheet's own column layout.
    try {
      const { schedulePushProductToSheet } = await import("./productSync");
      schedulePushProductToSheet(teamId, result.id);
    } catch {}
    res.json(result);
  });

  app.put("/api/products/:id", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getProduct(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const data: any = {};
    if (req.body.groupScope !== undefined) {
      if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
      data.groupScope = req.body.groupScope;
    }
    if (req.body.category !== undefined) data.category = req.body.category;
    if (req.body.brand !== undefined) data.brand = req.body.brand;
    if (req.body.name !== undefined) data.name = req.body.name;
    const updated = await storage.updateProduct(id, data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    await recordChange(req, "product", id, `Product edited: ${existing.brand ?? ""} ${existing.name ?? ""}`.trim(), existing, updated);
    await stampEdit("products", id, req);
    res.json(updated);
  });

  app.patch("/api/products/:id/stock", requirePermission("products", "view"), async (req, res) => {
    const id = parseInt(req.params.id);
    const { delta, quantity } = req.body;
    const existing = await storage.getProduct(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const oldQty = existing.stockQuantity ?? 0;
    let newQty: number;
    if (typeof quantity === "number" && Number.isInteger(quantity)) {
      newQty = Math.max(0, quantity);
    } else if (typeof delta === "number" && Number.isInteger(delta)) {
      newQty = Math.max(0, oldQty + delta);
    } else {
      return res.status(400).json({ message: "delta or quantity must be an integer" });
    }
    const updated = await storage.updateProduct(id, { stockQuantity: newQty } as any);
    try {
      const { schedulePushProductToSheet } = await import("./productSync");
      schedulePushProductToSheet(existing.teamId, id);
    } catch {}
    const u = userInfo(req);
    if (!isIncognito(req)) {
      const change = newQty - oldQty;
      const action = change > 0 ? "stock_added" : change < 0 ? "stock_removed" : "stock_set";
      try {
        await storage.createActivityLog({
          userId: u.id,
          userName: u.name,
          action,
          entityType: "product",
          entityId: id,
          details: `${existing.brand} ${existing.name}: ${oldQty} → ${newQty} (${change >= 0 ? "+" : ""}${change})`,
          createdAt: new Date().toISOString(),
          groupScope: existing.groupScope,
          teamId: getActiveTeamId(req),
        });
      } catch (_) {}
    }
    await stampEdit("products", id, req);
    res.json(updated);
  });


  // Brand-level order lifecycle: mark a brand's order as PLACED, undo it, or
  // mark it DELIVERED — delivery moves the ordered amounts into stock and
  // clears the counters, then pushes every affected row to the sheet.
  app.post("/api/products/order/brand-status", requirePermission("products", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const brand = String(req.body?.brand ?? "").trim();
    const action = String(req.body?.action ?? "");
    if (!brand || !["ordered", "unordered", "delivered"].includes(action)) {
      return res.status(400).json({ message: "brand and action (ordered|unordered|delivered) required" });
    }
    const { pool: pOrd } = await import("./db");
    const affected = await (pOrd as any).query(
      `SELECT id, brand, name, category, stock_quantity, order_quantity FROM products
       WHERE team_id = $1 AND LOWER(brand) = LOWER($2) AND order_quantity > 0`, [teamId, brand]);
    if (affected.rows.length === 0) return res.json({ ok: true, products: 0 });
    const u0 = userInfo(req);
    const itemsJson = JSON.stringify(affected.rows.map((r: any) => ({
      productId: r.id, label: `${r.brand} ${r.name} ${r.category ?? ""}`.trim(), qty: r.order_quantity,
    })));
    const nowIso = new Date().toISOString();

    if (action === "ordered" || action === "unordered") {
      await (pOrd as any).query(
        `UPDATE products SET order_placed = $1
         WHERE team_id = $2 AND LOWER(brand) = LOWER($3) AND order_quantity > 0`,
        [action === "ordered" ? 1 : 0, teamId, brand]);
      if (action === "ordered") {
        // One history row per placed order, snapshotting the contents.
        await (pOrd as any).query(
          `INSERT INTO product_orders (team_id, brand, items, status, ordered_at, ordered_by_id, ordered_by_name)
           VALUES ($1, $2, $3, 'ordered', $4, $5, $6)`,
          [teamId, brand, itemsJson, nowIso, u0.id, u0.name]);
      } else {
        // Undo removes the open history row — cancelled clicks are not history.
        await (pOrd as any).query(
          `DELETE FROM product_orders WHERE id = (
             SELECT id FROM product_orders WHERE team_id = $1 AND LOWER(brand) = LOWER($2) AND status = 'ordered'
             ORDER BY ordered_at DESC LIMIT 1)`, [teamId, brand]).catch(() => {});
      }
    } else {
      // Delivered: ordered amounts land in stock, counters reset.
      await (pOrd as any).query(
        `UPDATE products SET stock_quantity = stock_quantity + order_quantity, order_quantity = 0, order_placed = 0
         WHERE team_id = $1 AND LOWER(brand) = LOWER($2) AND order_quantity > 0`, [teamId, brand]);
      const u = userInfo(req);
      if (!isIncognito(req)) {
        const summary = affected.rows.map((r: any) => `${r.name} +${r.order_quantity}`).join(", ");
        await storage.createActivityLog({
          userId: u.id, userName: u.name, action: "stock_added",
          entityType: "product", entityId: null,
          details: `Order delivered — ${brand}: ${summary}`,
          createdAt: new Date().toISOString(), groupScope: u.groupScope.split(",")[0].trim(), teamId,
        } as any).catch(() => {});
      }
      try {
        const { schedulePushProductToSheet } = await import("./productSync");
        for (const r of affected.rows) schedulePushProductToSheet(teamId, r.id);
      } catch {}
      // Close the open history row with the snapshot that was actually delivered.
      await (pOrd as any).query(
        `UPDATE product_orders SET status = 'delivered', items = $1, delivered_at = $2, delivered_by_id = $3, delivered_by_name = $4
         WHERE id = (SELECT id FROM product_orders WHERE team_id = $5 AND LOWER(brand) = LOWER($6) AND status = 'ordered'
                     ORDER BY ordered_at DESC LIMIT 1)`,
        [itemsJson, nowIso, u0.id, u0.name, teamId, brand]).catch(() => {});
    }
    res.json({ ok: true, products: affected.rows.length });
  });

  // Order history — what was ordered when, by whom, and when it arrived.
  app.get("/api/product-orders", requirePermission("products", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const { pool: pOh } = await import("./db");
    const rows = (await (pOh as any).query(
      `SELECT id, brand, items, status, ordered_at AS "orderedAt", ordered_by_name AS "orderedByName",
              delivered_at AS "deliveredAt", delivered_by_name AS "deliveredByName"
       FROM product_orders WHERE team_id = $1 ORDER BY ordered_at DESC NULLS LAST LIMIT 200`, [teamId])).rows;
    res.json(rows.map((r: any) => ({ ...r, items: (() => { try { return JSON.parse(r.items); } catch { return []; } })() })));
  });

  // Push Glidr-only products into the linked sheet as new rows — the
  // reconciliation's "add the missing ones to the sheet" action.
  app.post("/api/products/push-to-sheet", requirePermission("products", "edit"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map((n: any) => parseInt(n)).filter((n: number) => !isNaN(n)) : [];
    if (ids.length === 0 || ids.length > 100) return res.status(400).json({ message: "ids (1-100) required" });
    const { pushProductToSheet } = await import("./productSync");
    let pushed = 0;
    for (const id of ids) {
      const prod = await storage.getProduct(id);
      if (!prod || !verifyTeamOwnership(prod, req)) continue;
      try {
        await pushProductToSheet(teamId, id);
        pushed++;
      } catch (e: any) {
        console.warn(`[ProductSync] push-to-sheet failed for #${id}:`, e?.message);
      }
      await new Promise((r) => setTimeout(r, 400)); // pace the Sheets API
    }
    res.json({ ok: true, pushed });
  });

  // Order quantity — the "to order" counter that turns Glidr into an ordering
  // terminal. Mirrors the stock endpoint; changes push to the linked sheet.
  app.patch("/api/products/:id/order", requirePermission("products", "view"), async (req, res) => {
    const id = parseInt(req.params.id);
    const { delta, quantity } = req.body;
    const existing = await storage.getProduct(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const oldQty = (existing as any).orderQuantity ?? 0;
    let newQty: number;
    if (typeof quantity === "number" && Number.isInteger(quantity)) {
      newQty = Math.max(0, quantity);
    } else if (typeof delta === "number" && Number.isInteger(delta)) {
      newQty = Math.max(0, oldQty + delta);
    } else {
      return res.status(400).json({ message: "delta or quantity must be an integer" });
    }
    const updated = await storage.updateProduct(id, { orderQuantity: newQty } as any);
    try {
      const { schedulePushProductToSheet } = await import("./productSync");
      schedulePushProductToSheet(existing.teamId, id);
    } catch {}
    await stampEdit("products", id, req);
    res.json(updated);
  });
  app.delete("/api/products/:id", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const existing = await storage.getProduct(id);
    if (existing && !verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteProduct(id);
    await recordDeletion(req, "product", id, existing ? `Product deleted: ${existing.brand ?? ""} ${existing.name ?? ""}`.trim() : "Product deleted", existing ?? null);
    res.json({ ok: true });
  });

  app.get("/api/products/archived", requirePermission("products", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listArchivedProducts(u.groupScope, u.isScopeAdmin, teamId);
    res.json(list);
  });

  // Product usage stats — which products have been tested and/or raced
  app.get("/api/products/usage-stats", requirePermission("products", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const { pool: pg } = await import("./db");

    // Tested: product IDs used in at least one test entry for this team
    const testedResult = await (pg as any).query(
      `SELECT DISTINCT te.product_id
       FROM test_entries te
       JOIN tests t ON t.id = te.test_id
       WHERE t.team_id = $1 AND te.product_id IS NOT NULL`,
      [teamId]
    );
    const testedIds: number[] = testedResult.rows.map((r: any) => Number(r.product_id));

    // Raced: product IDs used in any race prep's product_ids, structure_ids, or kick_product_ids
    const rpResult = await (pg as any).query(
      `SELECT product_ids, structure_ids, kick_product_ids FROM race_preps WHERE team_id = $1`,
      [teamId]
    );
    const racedSet = new Set<number>();
    for (const row of rpResult.rows) {
      for (const col of [row.product_ids, row.structure_ids, row.kick_product_ids]) {
        if (col) {
          for (const part of String(col).split(",")) {
            const n = parseInt(part.trim(), 10);
            if (!isNaN(n)) racedSet.add(n);
          }
        }
      }
    }

    return res.json({ racedIds: Array.from(racedSet), testedIds });
  });

  app.post("/api/products/:id/archive", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const existing = await storage.getProduct(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.archiveProduct(id);
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "archived",
        entityType: "product", entityId: id,
        details: `${existing.brand} ${existing.name}`, createdAt: new Date().toISOString(), groupScope: u.groupScope, teamId: getActiveTeamId(req),
      });
    } catch (_) {}
    res.json(updated);
  });

  app.post("/api/products/:id/restore", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const existing = await storage.getProduct(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.restoreProduct(id);
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "restored",
        entityType: "product", entityId: id,
        details: `${existing.brand} ${existing.name}`, createdAt: new Date().toISOString(), groupScope: u.groupScope, teamId: getActiveTeamId(req),
      });
    } catch (_) {}
    res.json(updated);
  });

  // Product test history
  app.get("/api/products/:id/tests", requirePermission("products", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const productId = parseInt(req.params.id);
    const product = await storage.getProduct(productId);
    if (!product) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(product, req)) return res.status(403).json({ message: "Forbidden" });

    const { pool: pg } = await import("./db");
    // Find tests where at least one entry references this product (directly or in additional_product_ids)
    const result = await (pg as any).query(
      `SELECT DISTINCT
         t.id, t.date, t.location, t.test_name, t.test_type, t.notes, t.weather_id,
         t.distance_labels, t.distance_label_0km, t.distance_label_xkm,
         w.air_temperature_c, w.snow_temperature_c, w.air_humidity_pct, w.snow_humidity_pct,
         w.snow_type, w.artificial_snow, w.natural_snow, w.grain_size, w.snow_humidity_type,
         w.track_hardness, w.test_quality, w.wind, w.clouds, w.precipitation
       FROM test_entries te
       JOIN tests t ON t.id = te.test_id
       LEFT JOIN daily_weather w ON w.id = t.weather_id
       WHERE t.team_id = $1
         AND (
           te.product_id = $2
           OR te.additional_product_ids LIKE $3
         )
       ORDER BY t.date DESC, t.id DESC`,
      [teamId, productId, `%${productId}%`]
    );

    const testIds: number[] = result.rows.map((r: any) => r.id);
    let entriesByTestId: Record<number, any[]> = {};
    if (testIds.length > 0) {
      // Fetch ALL entries for these tests so we can show every ski and highlight the selected product
      const entryRows = await (pg as any).query(
        `SELECT te.id, te.test_id, te.ski_number, te.product_id, te.additional_product_ids,
                te.result_0km_cm_behind, te.rank_0km, te.result_xkm_cm_behind, te.rank_xkm,
                te.results, te.feeling_rank, te.methodology,
                p.brand as product_brand, p.name as product_name
         FROM test_entries te
         LEFT JOIN products p ON p.id = te.product_id
         WHERE te.test_id = ANY($1)
         ORDER BY te.ski_number ASC`,
        [testIds]
      );

      // Collect all unique additional product IDs across all entries so we can
      // look up their brand/name in one query and show the full combination.
      const allAdditionalIds = new Set<number>();
      for (const e of entryRows.rows) {
        if (e.additional_product_ids) {
          for (const part of String(e.additional_product_ids).split(",")) {
            const n = parseInt(part.trim(), 10);
            if (!isNaN(n)) allAdditionalIds.add(n);
          }
        }
      }
      const additionalProductMap = new Map<number, { brand: string; name: string }>();
      if (allAdditionalIds.size > 0) {
        const addRows = await (pg as any).query(
          `SELECT id, brand, name FROM products WHERE id = ANY($1)`,
          [Array.from(allAdditionalIds)]
        );
        for (const p of addRows.rows) {
          additionalProductMap.set(p.id, { brand: p.brand, name: p.name });
        }
      }

      for (const e of entryRows.rows) {
        if (!entriesByTestId[e.test_id]) entriesByTestId[e.test_id] = [];
        const additionalIds: number[] = e.additional_product_ids
          ? String(e.additional_product_ids).split(",").map((x: string) => parseInt(x.trim(), 10)).filter((n: number) => !isNaN(n))
          : [];
        const isSelectedProduct =
          e.product_id === productId || additionalIds.includes(productId);
        const additionalProducts = additionalIds
          .map((id: number) => {
            const p = additionalProductMap.get(id);
            return p ? { id, brand: p.brand, name: p.name } : null;
          })
          .filter(Boolean) as { id: number; brand: string; name: string }[];

        // Blind testers / athlete-access accounts must not see product↔result
        // mappings — same redaction as /api/tests/:id/entries.
        const redactPT = req.user!.isBlindTester === 1 || (req.user as any).isAthleteAccess === 1;
        entriesByTestId[e.test_id].push({
          id: e.id, skiNumber: e.ski_number,
          productId: redactPT ? null : e.product_id, additionalProductIds: redactPT ? null : e.additional_product_ids,
          productBrand: redactPT ? null : e.product_brand, productName: redactPT ? null : e.product_name,
          additionalProducts: redactPT ? [] : additionalProducts,
          result0kmCmBehind: e.result_0km_cm_behind, rank0km: e.rank_0km,
          resultXkmCmBehind: e.result_xkm_cm_behind, rankXkm: e.rank_xkm,
          results: e.results, feelingRank: e.feeling_rank,
          methodology: redactPT ? null : (e.methodology ?? null),
          isSelectedProduct,
        });
      }
    }

    const tests = result.rows.map((r: any) => ({
      id: r.id, date: r.date, location: r.location, testName: r.test_name,
      testType: r.test_type, notes: r.notes,
      distanceLabels: r.distance_labels, distanceLabel0km: r.distance_label_0km, distanceLabelXkm: r.distance_label_xkm,
      weather: r.weather_id ? {
        airTemperatureC: r.air_temperature_c, snowTemperatureC: r.snow_temperature_c,
        airHumidityPct: r.air_humidity_pct, snowHumidityPct: r.snow_humidity_pct,
        snowType: r.snow_type, artificialSnow: r.artificial_snow, naturalSnow: r.natural_snow,
        grainSize: r.grain_size, snowHumidityType: r.snow_humidity_type, trackHardness: r.track_hardness,
        testQuality: r.test_quality, wind: r.wind, clouds: r.clouds, precipitation: r.precipitation,
      } : null,
      entries: entriesByTestId[r.id] || [],
    }));

    res.json({ tests });
  });

  // Product race prep history — race preps where this product was used
  app.get("/api/products/:id/race-preps", requirePermission("products", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const productId = parseInt(req.params.id);
    const { pool: pg } = await import("./db");

    const rpResult = await (pg as any).query(
      `SELECT rp.id, rp.date, rp.start_time AS "startTime", rp.location,
              rp.race_type AS "raceType", rp.discipline,
              rp.products, rp.method, rp.structure, rp.notes,
              rp.product_ids AS "productIds",
              rp.structure_ids AS "structureIds",
              rp.kick_product_ids AS "kickProductIds",
              rp.tette, rp.weather_id AS "weatherId",
              rp.created_by_name AS "createdByName",
              w.air_temperature_c AS "airTemperatureC",
              w.snow_temperature_c AS "snowTemperatureC",
              w.air_humidity_pct AS "airHumidityPct",
              w.snow_type AS "snowType",
              w.track_hardness AS "trackHardness",
              w.artificial_snow AS "artificialSnow"
       FROM race_preps rp
       LEFT JOIN daily_weather w ON w.id = rp.weather_id
       WHERE rp.team_id = $1
         AND (
           (',' || rp.product_ids || ',') LIKE ('%,' || $2 || ',%')
           OR (',' || rp.structure_ids || ',') LIKE ('%,' || $2 || ',%')
           OR (',' || rp.kick_product_ids || ',') LIKE ('%,' || $2 || ',%')
         )
       ORDER BY rp.date DESC`,
      [teamId, productId]
    );

    // Determine role of this product in each prep
    const rows = rpResult.rows.map((r: any) => {
      const parseIds = (s: string | null) =>
        s ? s.split(",").map((x: string) => parseInt(x.trim(), 10)).filter((n: number) => !isNaN(n)) : [];
      const productIds = parseIds(r.productIds);
      const structureIds = parseIds(r.structureIds);
      const kickIds = parseIds(r.kickProductIds);
      const roles: string[] = [];
      if (productIds.includes(productId)) roles.push("glide");
      if (structureIds.includes(productId)) roles.push("structure");
      if (kickIds.includes(productId)) roles.push("kick");
      return { ...r, roles };
    });

    return res.json(rows);
  });

  // ── Share products between teams ──────────────────────────────────────────
  // A copy, not a link: the target team gets identical products (category,
  // brand, name) with the chosen group scope — statistics and test data stay
  // where they were made. TA-only, and only between teams where the caller
  // holds team-admin rights on BOTH sides (a TA holds all groups by rule).
  app.get("/api/products/share-targets", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team Admin only" });
    const activeId = getActiveTeamId(req);
    const { pool: pgS } = await import("./db");
    const allTeams = await storage.listTeams();
    let taTeamIds: Set<number>;
    if (u.isAdmin) {
      taTeamIds = new Set(allTeams.map((t) => t.id));
    } else {
      taTeamIds = new Set<number>();
      const rawUser = req.user as any;
      if (rawUser.isTeamAdmin === 1) taTeamIds.add(rawUser.teamId);
      const r = await (pgS as any).query(
        `SELECT team_id FROM user_team_permissions WHERE user_id = $1 AND is_team_admin = 1`, [u.id]);
      for (const row of r.rows) taTeamIds.add(row.team_id);
    }
    const targets = [];
    for (const t of allTeams) {
      if (t.id === activeId || !taTeamIds.has(t.id)) continue;
      const g = await (pgS as any).query(`SELECT id, name FROM groups WHERE team_id = $1 ORDER BY name`, [t.id]).catch(() => ({ rows: [] }));
      targets.push({ teamId: t.id, teamName: t.name, groups: g.rows.map((x: any) => x.name) });
    }
    res.json({ targets });
  });

  app.post("/api/products/share-to-teams", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team Admin only" });
    const activeId = getActiveTeamId(req);
    const productIds: number[] = Array.isArray(req.body.productIds)
      ? req.body.productIds.map((n: any) => parseInt(String(n))).filter((n: number) => !isNaN(n))
      : [];
    const targets: { teamId: number; groups: string[] }[] = Array.isArray(req.body.targets) ? req.body.targets : [];
    if (productIds.length === 0 || targets.length === 0) {
      return res.status(400).json({ message: "productIds and targets required" });
    }
    const { pool: pgS } = await import("./db");

    // TA rights on every target team.
    let taTeamIds: Set<number>;
    if (u.isAdmin) {
      taTeamIds = new Set((await storage.listTeams()).map((t) => t.id));
    } else {
      taTeamIds = new Set<number>();
      const rawUser = req.user as any;
      if (rawUser.isTeamAdmin === 1) taTeamIds.add(rawUser.teamId);
      const r = await (pgS as any).query(
        `SELECT team_id FROM user_team_permissions WHERE user_id = $1 AND is_team_admin = 1`, [u.id]);
      for (const row of r.rows) taTeamIds.add(row.team_id);
    }
    for (const t of targets) {
      if (!taTeamIds.has(t.teamId)) {
        return res.status(403).json({ message: "You must be Team Admin on every target team" });
      }
    }

    // Source products must belong to the caller's active team.
    const src = await (pgS as any).query(
      `SELECT id, category, brand, name, is_mix FROM products WHERE id = ANY($1::int[]) AND team_id = $2`,
      [productIds, activeId]);
    const norm = (x: string) => x.toLowerCase().replace(/\s+/g, " ").trim();
    const now = new Date().toISOString();
    const activeTeam = await storage.getTeam(activeId!);
    const results: { teamId: number; created: number; skipped: number; mixesSkipped: number }[] = [];

    for (const t of targets) {
      const groupScope = (t.groups ?? []).map((g) => String(g).trim()).filter(Boolean).join(",");
      const existing = await (pgS as any).query(
        `SELECT brand, name FROM products WHERE team_id = $1`, [t.teamId]);
      const have = new Set(existing.rows.map((r: any) => `${norm(r.brand ?? "")}|${norm(r.name ?? "")}`));
      let created = 0, skipped = 0, mixesSkipped = 0;
      for (const p of src.rows) {
        // Mixes stay home: their recipe and serial reference the source team's
        // own catalogue and numbering.
        if (p.is_mix === 1) { mixesSkipped++; continue; }
        if (have.has(`${norm(p.brand ?? "")}|${norm(p.name ?? "")}`)) { skipped++; continue; }
        await storage.createProduct({
          category: p.category,
          brand: p.brand,
          name: p.name,
          createdAt: now,
          createdById: u.id,
          createdByName: u.name,
          groupScope,
          teamId: t.teamId,
        });
        have.add(`${norm(p.brand ?? "")}|${norm(p.name ?? "")}`);
        created++;
      }
      // Traceability on BOTH sides — sharing between teams is never silent.
      const teamRec = await storage.getTeam(t.teamId);
      try {
        await storage.createActivityLog({
          userId: u.id, userName: u.name, action: "products_shared_out",
          entityType: "products", entityId: activeId ?? 0,
          details: `${created} product(s) shared to ${teamRec?.name ?? t.teamId}`,
          createdAt: now, groupScope: "", teamId: activeId,
        } as any);
        await storage.createActivityLog({
          userId: u.id, userName: u.name, action: "products_shared_in",
          entityType: "products", entityId: t.teamId,
          details: `${created} product(s) shared from ${activeTeam?.name ?? activeId}${groupScope ? ` (groups: ${groupScope})` : ""}`,
          createdAt: now, groupScope: "", teamId: t.teamId,
        } as any);
      } catch (_) {}
      results.push({ teamId: t.teamId, created, skipped, mixesSkipped });
    }
    res.json({ results });
  });

  app.post("/api/products/bulk-assign-group", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
    const { ids, groupScope } = req.body as { ids: number[]; groupScope: string };
    if (!Array.isArray(ids) || !groupScope) return res.status(400).json({ message: "ids and groupScope required" });
    for (const id of ids) {
      const prod = await storage.getProduct(id);
      if (!prod || !verifyTeamOwnership(prod, req)) continue;
      await storage.updateProduct(id, { groupScope });
    }
    if (!isIncognito(req) && ids.length > 0) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "updated",
        entityType: "product", entityId: 0,
        details: `Assigned ${ids.length} product(s) to group: ${groupScope}`,
        createdAt: new Date().toISOString(), groupScope: u.groupScope, teamId: getActiveTeamId(req),
      });
    } catch (_) {}
    res.json({ updated: ids.length });
  });

  app.post("/api/products/remove-duplicates", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
    const teamId = getActiveTeamId(req);
    const all = await storage.listProducts(u.groupScope, u.isScopeAdmin, teamId);
    const seen = new Map<string, number>();
    const toDelete: number[] = [];
    for (const p of all.sort((a, b) => a.id - b.id)) {
      const key = `${p.teamId}|${p.category}|${(p.brand || "").toLowerCase().trim()}|${(p.name || "").toLowerCase().trim()}`;
      if (seen.has(key)) {
        toDelete.push(p.id);
      } else {
        seen.set(key, p.id);
      }
    }
    for (const id of toDelete) {
      await storage.deleteProduct(id);
    }
    if (!isIncognito(req) && toDelete.length > 0) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "deleted",
        entityType: "product", entityId: 0,
        details: `Removed ${toDelete.length} duplicate product(s)`, createdAt: new Date().toISOString(), groupScope: u.groupScope, teamId,
      });
    } catch (_) {}
    res.json({ removed: toDelete.length });
  });

  app.get("/api/weather", requirePermission("weather", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list: any[] = await storage.listWeather(u.groupScope, u.isScopeAdmin, teamId);
    // Child team: parent's weather logs (read-only) when 'weather' is shared —
    // also lets shared tests resolve their linked weather.
    const share = await getParentShare(teamId);
    if (share && share.sharedAreas.includes("weather")) {
      const parentList = await storage.listWeather("", true, share.parentTeamId);
      for (const w of parentList) list.push({ ...w, sharedFromTeam: share.parentName, readOnly: true });
    }
    res.json(list);
  });

  // Lightweight weather lookup used for filter dropdowns/maps — available to any
  // authenticated team member, regardless of whether they have weather permission.
  // Athlete access users cannot see weather data.
  app.get("/api/weather/for-filtering", requireAuth, async (req, res) => {
    if ((req.user as any).isAthleteAccess === 1) return res.json([]);
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT id, date, time, location,
              air_temperature_c AS "airTemperatureC",
              snow_temperature_c AS "snowTemperatureC",
              air_humidity_pct AS "airHumidityPct",
              snow_humidity_pct AS "snowHumidityPct",
              clouds, visibility, wind, precipitation,
              artificial_snow AS "artificialSnow",
              natural_snow AS "naturalSnow",
              grain_size AS "grainSize",
              snow_humidity_type AS "snowHumidityType",
              track_hardness AS "trackHardness",
              test_quality AS "testQuality",
              snow_type AS "snowType"
       FROM daily_weather
       WHERE team_id = $1`,
      [teamId]
    );
    const rows: any[] = result.rows;
    const shareW = await getParentShare(teamId);
    if (shareW && shareW.sharedAreas.includes("weather")) {
      const pr = await (pool as any).query(
        `SELECT id, date, time, location,
                air_temperature_c AS "airTemperatureC",
                snow_temperature_c AS "snowTemperatureC",
                air_humidity_pct AS "airHumidityPct",
                snow_humidity_pct AS "snowHumidityPct",
                clouds, visibility, wind, precipitation,
                artificial_snow AS "artificialSnow",
                natural_snow AS "naturalSnow",
                grain_size AS "grainSize",
                snow_humidity_type AS "snowHumidityType",
                track_hardness AS "trackHardness",
                test_quality AS "testQuality",
                snow_type AS "snowType"
         FROM daily_weather WHERE team_id = $1`, [shareW.parentTeamId]);
      for (const w of pr.rows) rows.push({ ...w, sharedFromTeam: shareW.parentName, readOnly: true });
    }
    res.json(rows);
  });

  app.get("/api/weather/find", requirePermission("weather", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { date, location } = req.query as { date: string; location: string };
    if (!date || !location) return res.status(400).json({ message: "date and location required" });
    const w = await storage.findWeather(date, location, u.groupScope, teamId);
    res.json(w || null);
  });

  app.post("/api/weather", requirePermission("weather", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const now = new Date().toISOString();
    const groupScope = resolveCreateGroupScope(req);
    const result = await storage.createWeather({
      date: req.body.date,
      time: req.body.time,
      location: req.body.location.trim(),
      snowTemperatureC: req.body.snowTemperatureC,
      airTemperatureC: req.body.airTemperatureC,
      snowHumidityPct: req.body.snowHumidityPct,
      airHumidityPct: req.body.airHumidityPct,
      clouds: req.body.clouds ?? null,
      visibility: req.body.visibility?.trim() || null,
      wind: req.body.wind?.trim() || null,
      precipitation: req.body.precipitation?.trim() || null,
      artificialSnow: req.body.artificialSnow || null,
      naturalSnow: req.body.naturalSnow || null,
      grainSize: req.body.grainSize || null,
      snowHumidityType: req.body.snowHumidityType || null,
      trackHardness: req.body.trackHardness || null,
      testQuality: req.body.testQuality ?? null,
      snowType: req.body.snowType?.trim() || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "weather", entityId: result.id,
        details: `Weather: ${req.body.date} ${req.body.location}`, createdAt: new Date().toISOString(), groupScope, teamId,
      });
    } catch (_) {}
    res.json(result);
  });

  // Create weather record from test creation/edit context — requires test edit permission, not weather permission
  app.post("/api/weather/for-test", requirePermission("tests", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const now = new Date().toISOString();
    const groupScope = req.body.groupScope?.trim() || resolveCreateGroupScope(req);
    const result = await storage.createWeather({
      date: req.body.date,
      time: req.body.time,
      location: req.body.location.trim(),
      snowTemperatureC: req.body.snowTemperatureC,
      airTemperatureC: req.body.airTemperatureC,
      snowHumidityPct: req.body.snowHumidityPct ?? null,
      airHumidityPct: req.body.airHumidityPct ?? null,
      clouds: req.body.clouds ?? null,
      visibility: req.body.visibility?.trim() || null,
      wind: req.body.wind?.trim() || null,
      precipitation: req.body.precipitation?.trim() || null,
      artificialSnow: req.body.artificialSnow || null,
      naturalSnow: req.body.naturalSnow || null,
      grainSize: req.body.grainSize || null,
      snowHumidityType: req.body.snowHumidityType || null,
      trackHardness: req.body.trackHardness || null,
      testQuality: req.body.testQuality ?? null,
      snowType: req.body.snowType?.trim() || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    res.json(result);
  });

  app.put("/api/weather/:id", requirePermission("weather", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getWeather(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.updateWeather(id, {
      date: req.body.date,
      time: req.body.time,
      location: req.body.location.trim(),
      snowTemperatureC: req.body.snowTemperatureC,
      airTemperatureC: req.body.airTemperatureC,
      snowHumidityPct: req.body.snowHumidityPct,
      airHumidityPct: req.body.airHumidityPct,
      clouds: req.body.clouds ?? null,
      visibility: req.body.visibility?.trim() || null,
      wind: req.body.wind?.trim() || null,
      precipitation: req.body.precipitation?.trim() || null,
      artificialSnow: req.body.artificialSnow || null,
      naturalSnow: req.body.naturalSnow || null,
      grainSize: req.body.grainSize || null,
      snowHumidityType: req.body.snowHumidityType || null,
      trackHardness: req.body.trackHardness || null,
      testQuality: req.body.testQuality ?? null,
      snowType: req.body.snowType?.trim() || null,
    });
    await recordChange(req, "weather", id, `Weather edited: ${existing.location} (${existing.date})`, existing, updated);
    await stampEdit("daily_weather", id, req);
    res.json(updated);
  });

  app.delete("/api/weather/:id", requirePermission("weather", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getWeather(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteWeather(id);
    await recordDeletion(req, "weather", id, `Weather deleted: ${existing.location} (${existing.date})`, existing);
    res.json({ ok: true });
  });

  // ── Weather station routes ─────────────────────────────────────────────────

  // GET weather station config for current team
  app.get("/api/weather-station/config", requireAuth, async (req, res) => {
    const team = await storage.getTeam(getActiveTeamId(req));
    res.json({
      stationType: team?.weatherStationType ?? null,
      connected: !!team?.weatherStationType,
      stationLabel: team?.weatherStationType ?? null,
    });
  });

  // Save weather station config (team admin only)
  app.put("/api/weather-station/config", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ error: "Forbidden" });
    const { stationType, config } = req.body;
    await storage.updateTeam(getActiveTeamId(req), {
      weatherStationType: stationType || null,
      weatherStationConfig: config ? JSON.stringify(config) : null,
    });
    res.json({ ok: true });
  });

  // Test connection
  app.post("/api/weather-station/test", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ error: "Forbidden" });
    const { stationType, config } = req.body;
    try {
      const { fetchWeatherFromStation } = await import("./weatherStation");
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toTimeString().slice(0, 5);
      const result = await fetchWeatherFromStation(stationType, config, date, time);
      res.json({ ok: true, sample: result });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message || "Connection failed" });
    }
  });

  // Fetch weather for a specific date+time from configured station
  app.get("/api/weather-station/fetch", requireAuth, async (req, res) => {
    const team = await storage.getTeam(getActiveTeamId(req));
    if (!team?.weatherStationType || !team?.weatherStationConfig) {
      return res.status(404).json({ error: "No weather station configured" });
    }
    const { date, time } = req.query as { date: string; time: string };
    if (!date || !time) return res.status(400).json({ error: "date and time required" });
    try {
      const { fetchWeatherFromStation } = await import("./weatherStation");
      const config = JSON.parse(team.weatherStationConfig);
      const result = await fetchWeatherFromStation(team.weatherStationType, config, date, time);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Fetch failed" });
    }
  });

  app.get("/api/tests", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    let result: any[] = [];
    const seenIds = new Set<number>();

    if (u.isScopeAdmin) {
      // Team Admin / Super Admin: see all tests in their active team
      const all = await storage.listAllTestsForTeam(teamId);
      for (const t of all) { result.push(t); seenIds.add(t.id); }
    } else if ((req.user as any).isAthleteAccess === 1) {
      const linkedAthleteId = (req.user as any).linkedAthleteId;
      if (linkedAthleteId) {
        const allTeamTests = await storage.listAllTestsForTeam(teamId);
        for (const t of allTeamTests) {
          if (!seenIds.has(t.id) && (t as any).testSkiSource === "raceskis" && (t as any).athleteId === linkedAthleteId) {
            result.push(t);
            seenIds.add(t.id);
          }
        }
      }
    } else {
      // Non-raceski tests: only visible when 'tests' permission is granted
      // Retroactive: losing permission removes access to all previous tests too
      if (u.permissions.tests !== "none") {
        const scopedTests = await storage.listTests(u.groupScope, false, teamId);
        for (const t of scopedTests) {
          if (!seenIds.has(t.id) && (t as any).testSkiSource !== "raceskis") {
            result.push(t);
            seenIds.add(t.id);
          }
        }
      }

      // Raceski tests: only visible when 'raceskis' permission is granted AND user has athlete access
      if (u.permissions.raceskis !== "none") {
        const athleteIds = await storage.listAthleteIdsForUser(u.id);
        if (athleteIds.length > 0) {
          const allTeamTests = await storage.listAllTestsForTeam(teamId);
          for (const t of allTeamTests) {
            if (!seenIds.has(t.id) && (t as any).testSkiSource === "raceskis" &&
                (t as any).athleteId && athleteIds.includes((t as any).athleteId)) {
              result.push(t);
              seenIds.add(t.id);
            }
          }
        }
      }

      // Filter out grinding tests if no grinding permission
      if (u.permissions.grinding === "none") {
        result = result.filter((t: any) => t.testType !== "Grind");
      }
    }

    const seriesIds = [...new Set(result.filter((t: any) => t.seriesId).map((t: any) => t.seriesId))];
    let seriesNameMap: Record<number, string> = {};
    if (seriesIds.length > 0) {
      const seriesList = await db.select({ id: testSkiSeries.id, name: testSkiSeries.name }).from(testSkiSeries).where(inArray(testSkiSeries.id, seriesIds));
      for (const s of seriesList) seriesNameMap[s.id] = s.name;
    }
    let enriched = result.map((t: any) => ({ ...t, seriesName: t.seriesId ? (seriesNameMap[t.seriesId] || null) : null }));

    // Child team: append the parent's shared tests (read-only, curated).
    const share = await getParentShare(teamId);
    if (share && share.sharedAreas.includes("tests")) {
      const excl = await getChildExclusions(share.parentTeamId);
      const parentTests = await storage.listAllTestsForTeam(share.parentTeamId);
      const pIds = parentTests.filter((t: any) => !excl.tests.has(t.id)).map((t: any) => t.id);
      const pSeriesIds = [...new Set(parentTests.filter((t: any) => t.seriesId).map((t: any) => t.seriesId))];
      let pSeriesNames: Record<number, string> = {};
      if (pSeriesIds.length > 0) {
        const sl = await db.select({ id: testSkiSeries.id, name: testSkiSeries.name }).from(testSkiSeries).where(inArray(testSkiSeries.id, pSeriesIds as number[]));
        for (const s of sl) pSeriesNames[s.id] = s.name;
      }
      for (const t of parentTests) {
        if (!pIds.includes(t.id)) continue;
        // Athlete race-ski tests stay private to the parent's athletes.
        if ((t as any).testSkiSource === "raceskis") continue;
        // Grind tests are their own shared area — never implied by 'tests'.
        if ((t as any).testType === "Grind" && !share.sharedAreas.includes("grinding")) continue;
        // Strip the raw runsheet bracket — it contains every pair's results
        // and would reveal ski pairs the parent has hidden.
        const { runsheetBracket: _rb, ...safeT } = t as any;
        enriched.push({
          ...safeT,
          seriesName: (t as any).seriesId ? (pSeriesNames[(t as any).seriesId] || null) : null,
          sharedFromTeam: share.parentName,
          readOnly: true,
        });
      }
    }
    res.json(enriched);
  });

  // Cross-team combined test view: tests from every team the caller can access,
  // each tagged with its team name + weather, so they can search/filter by
  // location and weather across all their teams at once. Per-team permissions
  // and group scope are resolved independently for each team — no leakage.
  app.get("/api/tests/cross-team", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const rawUser = req.user as any;
    const isAthleteAccess = rawUser.isAthleteAccess === 1;
    const linkedAthleteId = rawUser.linkedAthleteId ?? null;
    const withEntries = req.query.withEntries === "1"; // "Show all" → include result rows
    const { pool: p } = await import("./db");

    // Access gate: the caller must have been granted the "All teams" permission
    // (or be a Super Admin) AND belong to more than one team.
    const memberships = await storage.getUserTeams(u.id);
    const teamCount = new Set<number>([u.teamId, ...memberships.map((m: any) => m.teamId)]).size;
    if (!u.isAdmin && (rawUser.canViewAllTeams !== 1 || teamCount < 2)) {
      return res.status(403).json({ message: "No access to the All teams view" });
    }

    // Teams the caller can access: primary + explicit memberships (SA = all).
    let teamIds = [...new Set<number>([u.teamId, ...memberships.map((m: any) => m.teamId)])];
    const allTeams = await storage.listTeams();
    if (u.isAdmin) teamIds = allTeams.map((t) => t.id);
    const teamNameById = new Map<number, string>(allTeams.map((t) => [t.id, t.name]));

    // Per-team permission overrides for this user.
    const tpRes = await (p as any).query(
      "SELECT team_id, permissions, group_scope, is_team_admin FROM user_team_permissions WHERE user_id = $1",
      [u.id]
    );
    const overrides = new Map<number, any>(tpRes.rows.map((r: any) => [r.team_id, r]));
    const athleteIds = await storage.listAthleteIdsForUser(u.id);

    const combined: any[] = [];
    for (const tid of teamIds) {
      // Resolve the caller's effective permissions/group scope FOR THIS TEAM.
      let perms = u.permissions;
      let groupScope = String(rawUser.groupScope ?? "");
      let isScopeAdmin = false;
      if (u.isAdmin) {
        isScopeAdmin = true;
      } else if (tid === u.teamId) {
        perms = parsePermissions(rawUser.permissions, false, rawUser.isTeamAdmin === 1);
        groupScope = String(rawUser.groupScope ?? "");
        isScopeAdmin = rawUser.isTeamAdmin === 1;
      } else {
        const ov = overrides.get(tid);
        if (ov) {
          perms = parsePermissions(ov.permissions, false, ov.is_team_admin === 1);
          groupScope = String(ov.group_scope ?? rawUser.groupScope ?? "");
          isScopeAdmin = ov.is_team_admin === 1;
        } else {
          // No per-team override → fall back to the user's global permissions.
          perms = parsePermissions(rawUser.permissions, false, false);
          groupScope = String(rawUser.groupScope ?? "");
          isScopeAdmin = false;
        }
      }

      const tests = await collectTeamVisibleTests({
        teamId: tid, perms, groupScope, isScopeAdmin, isAthleteAccess, linkedAthleteId, athleteIds,
      });
      if (tests.length === 0) continue;

      // The All-teams view is for glide/product testing only — not athlete
      // (race-ski) tests (private per athlete) and not grind tests.
      const visible = tests.filter((t: any) => t.testSkiSource !== "raceskis" && t.testType !== "Grind");
      if (visible.length === 0) continue;

      // Weather lookup for this team (id → weather record).
      const weatherList = await storage.listAllWeatherForTeam(tid).catch(() => []);
      const weatherById = new Map<number, any>((weatherList as any[]).map((w) => [w.id, w]));

      // When "Show all" is requested, resolve each test's entries + product names
      // server-side (products live per team) so the client can render complete
      // result tables across teams.
      let productName = new Map<number, string>();
      let entriesByTest = new Map<number, any[]>();
      if (withEntries) {
        const pr = await (p as any).query(`SELECT id, brand, name, category FROM products WHERE team_id = $1`, [tid]).catch(() => ({ rows: [] }));
        // Same label convention as everywhere: category as the tail of the name.
        productName = new Map<number, string>(pr.rows.map((r: any) => {
          const cat = r.category && !/structure|tool/i.test(r.category) ? ` ${r.category}` : "";
          return [r.id, `${r.brand ?? ""} ${r.name ?? ""}`.trim() + cat];
        }));
        const ids = visible.map((t: any) => t.id);
        const er = await (p as any).query(`SELECT * FROM test_entries WHERE test_id = ANY($1::int[]) ORDER BY ski_number ASC`, [ids]).catch(() => ({ rows: [] }));
        for (const e of er.rows) {
          const arr = entriesByTest.get(e.test_id) ?? [];
          arr.push(e);
          entriesByTest.set(e.test_id, arr);
        }
      }

      for (const t of visible) {
        const base: any = {
          ...t,
          teamId: tid,
          teamName: teamNameById.get(tid) ?? `Team ${tid}`,
          weather: (t as any).weatherId ? (weatherById.get((t as any).weatherId) ?? null) : null,
        };
        if (withEntries) {
          const labels = srvDistanceLabels(t);
          base.distanceLabels = labels;
          base.entries = (entriesByTest.get((t as any).id) ?? []).map((e: any) => {
            const additional = (e.additional_product_ids || "").split(",").map((n: string) => parseInt(n)).filter((n: number) => !isNaN(n) && n > 0);
            const names = [
              e.product_id ? (productName.get(e.product_id) || null) : (e.free_text_product || null),
              ...additional.map((id: number) => productName.get(id) || null),
            ].filter((x: any): x is string => !!x);
            const redactXT = req.user!.isBlindTester === 1 || (req.user as any).isAthleteAccess === 1;
            return {
              skiNumber: e.ski_number,
              productNames: redactXT ? [] : names,
              methodology: redactXT ? "" : (e.methodology || ""),
              rounds: srvEntryRounds(e, labels.length),
              feelingRank: e.feeling_rank ?? null,
              kickRank: e.kick_rank ?? null,
            };
          });
        }
        combined.push(base);
      }
    }
    // Newest first by test date, then created.
    combined.sort((a, b) => {
      const da = new Date(a.date ?? a.createdAt ?? 0).getTime();
      const db2 = new Date(b.date ?? b.createdAt ?? 0).getTime();
      return db2 - da;
    });
    res.json(combined);
  });

  // Compare up to 4 tests side by side: returns each test with its full result
  // rows (product names resolved server-side), only for tests the caller may read.
  app.get("/api/tests/compare", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const ids = String(req.query.ids || "").split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)).slice(0, 4);
    if (ids.length === 0) return res.json([]);
    const { pool: p } = await import("./db");
    const out: any[] = [];
    for (const id of ids) {
      const test = await storage.getTest(id);
      if (!test || !verifyTeamOwnership(test, req)) continue;
      let ok = u.isScopeAdmin;
      if (!ok) {
        if ((test as any).testSkiSource === "raceskis") {
          ok = u.permissions.raceskis !== "none" && !!(test as any).athleteId &&
               await storage.hasAthleteAccess((test as any).athleteId, u.id, false, getActiveTeamId(req));
        } else {
          ok = u.permissions.tests !== "none" && userHasGroupAccess(u.groupScope, u.isScopeAdmin, test.groupScope);
        }
      }
      if (!ok) continue;
      if ((test as any).testType === "Grind" && u.permissions.grinding === "none") continue;

      const tid = (test as any).teamId;
      const pr = await (p as any).query(`SELECT id, brand, name FROM products WHERE team_id = $1`, [tid]).catch(() => ({ rows: [] }));
      const productName = new Map<number, string>(pr.rows.map((r: any) => [r.id, `${r.brand ?? ""} ${r.name ?? ""}`.trim()]));
      const er = await (p as any).query(`SELECT * FROM test_entries WHERE test_id = $1 ORDER BY ski_number ASC`, [id]).catch(() => ({ rows: [] }));
      const labels = srvDistanceLabels(test);
      const entries = er.rows.map((e: any) => {
        const additional = (e.additional_product_ids || "").split(",").map((n: string) => parseInt(n)).filter((n: number) => !isNaN(n) && n > 0);
        const names = [
          e.product_id ? (productName.get(e.product_id) || null) : (e.free_text_product || null),
          ...additional.map((pid: number) => productName.get(pid) || null),
        ].filter((x: any): x is string => !!x);
        const redactCmp = req.user!.isBlindTester === 1 || (req.user as any).isAthleteAccess === 1;
        return { skiNumber: e.ski_number, productNames: redactCmp ? [] : names, methodology: redactCmp ? "" : (e.methodology || ""), rounds: srvEntryRounds(e, labels.length), feelingRank: e.feeling_rank ?? null, kickRank: e.kick_rank ?? null };
      });
      out.push({ id: test.id, date: test.date, startTime: (test as any).startTime, location: test.location, testName: (test as any).testName, testType: (test as any).testType, teamId: tid, distanceLabels: labels, entries });
    }
    out.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    res.json(out);
  });

  app.post("/api/tests", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const testSkiSourceCheck = req.body.testSkiSource === "raceskis" ? "raceskis" : "series";
    let canCreateTest = u.isAdmin || u.isTeamAdmin || u.permissions.tests === "edit"
      || (testSkiSourceCheck === "raceskis" && u.permissions.raceskis !== "none");
    if (!canCreateTest && testSkiSourceCheck === "raceskis" && req.body.athleteId) {
      canCreateTest = await storage.hasAthleteAccess(req.body.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!canCreateTest) return res.status(403).json({ message: "No access" });
    if (req.body.testType === "Grind" && u.permissions.grinding === "none") {
      return res.status(403).json({ message: "Grinding access required" });
    }
    const testLimit = await checkTeamLimit(teamId, "tests");
    if (!testLimit.allowed) return res.status(403).json({ message: `Team has reached the test limit (${testLimit.limit}).` });
    const now = new Date().toISOString();
    const groupScope = resolveCreateGroupScope(req);
    const testSkiSource = req.body.testSkiSource === "raceskis" ? "raceskis" : "series";
    const raceOnly = ["Classic", "Skating", "Double Poling", "Mix"];
    const seriesOnly = ["Glide", "Structure", "Grind"];
    if (testSkiSource === "raceskis" && seriesOnly.includes(req.body.testType)) {
      return res.status(400).json({ message: "Race ski tests only allow Classic, Skating, or Double Poling" });
    }
    if (testSkiSource !== "raceskis" && raceOnly.includes(req.body.testType)) {
      return res.status(400).json({ message: "Classic/Skating/Double Poling are only for race ski tests" });
    }

    let entries = req.body.entries || [];
    if (testSkiSource === "raceskis") {
      // Scaffold rows (no ski, no free text, no data) are never results —
      // enforced here so no stale client can save them.
      entries = entries.filter((e: any) => e.raceSkiId || e.freeTextProduct
        || e.result0kmCmBehind != null || e.feelingRank != null
        || (Array.isArray(e.results) && e.results.some((r: any) => r?.result != null)));
      const raceSkiIds = entries.map((e: any) => e.raceSkiId).filter(Boolean);
      if (raceSkiIds.length > 0) {
        const allowedSkis = await storage.listAllRaceSkisForUser(u.id, u.isScopeAdmin, getActiveTeamId(req));
        const allowedIds = new Set(allowedSkis.map((s: any) => s.id));
        // Team fleet skis (no athlete) are open to every raceskis-level user.
        try {
          const { pool: pgFl } = await import("./db");
          const fl = await (pgFl as any).query(
            `SELECT rs.id FROM race_skis rs JOIN athletes a ON a.id = rs.athlete_id AND a.is_fleet = 1
             WHERE a.team_id = $1`, [getActiveTeamId(req)]);
          for (const row of fl.rows) allowedIds.add(row.id);
        } catch { /* additive */ }
        for (const rsId of raceSkiIds) {
          if (!allowedIds.has(rsId)) {
            return res.status(403).json({ message: "Access denied to race ski " + rsId });
          }
        }
      }
    }

    // Photocell speed tests store seconds instead of cm — only for teams with
    // the time_tests feature; everyone else silently stays on cm.
    const resultUnit = req.body.resultUnit === "time" && (await teamHasFeature(teamId, "time_tests")) ? "time" : "cm";

    // Fleet tests belong to the hidden fleet athlete: if no athlete was given
    // and the entries' skis are the fleet's, attach it so the test shows on
    // the Race fleets page's Tests tab.
    let resolvedAthleteId = testSkiSource === "raceskis" ? (req.body.athleteId || null) : null;
    if (testSkiSource === "raceskis" && !resolvedAthleteId) {
      try {
        const { pool: pgFT } = await import("./db");
        const ids = (req.body.entries || []).map((e: any) => e.raceSkiId).filter(Boolean);
        if (ids.length > 0) {
          const r = await (pgFT as any).query(
            `SELECT DISTINCT a.id FROM race_skis rs JOIN athletes a ON a.id = rs.athlete_id
             WHERE rs.id = ANY($1::int[]) AND a.is_fleet = 1 AND a.team_id = $2`, [ids, teamId]);
          if (r.rows.length === 1) resolvedAthleteId = r.rows[0].id;
        }
      } catch { /* best-effort */ }
    }

    const test = await storage.createTest({
      resultUnit,
      date: req.body.date,
      location: req.body.location.trim(),
      testName: req.body.testName?.trim() || null,
      weatherId: req.body.weatherId || null,
      noWeather: req.body.noWeather ? 1 : 0,
      testType: req.body.testType,
      seriesId: testSkiSource === "raceskis" ? null : req.body.seriesId,
      athleteId: resolvedAthleteId,
      testSkiSource,
      notes: req.body.notes?.trim() || null,
      distanceLabel0km: req.body.distanceLabel0km?.trim() || null,
      distanceLabelXkm: req.body.distanceLabelXkm?.trim() || null,
      distanceLabels: req.body.distanceLabels || null,
      grindParameters: req.body.grindParameters || null,
      startTime: req.body.startTime?.trim() || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "test", entityId: test.id,
        details: `Test: ${req.body.testType} on ${req.body.date}`, createdAt: new Date().toISOString(), groupScope, teamId,
      });
    } catch (_) {}

    if (resultUnit === "time") applyAvgRanks(entries);
    for (const e of entries) {
      await storage.createEntry({
        testId: test.id,
        skiNumber: e.skiNumber,
        productId: e.productId || null,
        freeTextProduct: e.freeTextProduct || null,
        additionalProductIds: e.additionalProductIds || null,
        methodology: e.methodology || "",
        result0kmCmBehind: e.result0kmCmBehind ?? null,
        rank0km: e.rank0km ?? null,
        resultXkmCmBehind: e.resultXkmCmBehind ?? null,
        rankXkm: e.rankXkm ?? null,
        results: e.results || null,
        feelingRank: e.feelingRank ?? null,
        feelingNote: e.feelingNote ?? null,
        kickRank: e.kickRank ?? null,
        kickSolution: e.kickSolution ?? null,
        grindType: e.grindType || null,
        grindStone: e.grindStone || null,
        grindPattern: e.grindPattern || null,
        grindExtraParams: e.grindExtraParams || null,
        grindProfileId: e.grindProfileId || null,
        raceSkiId: e.raceSkiId || null,
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope,
        teamId,
      });
    }

    res.json(test);
  });

  app.get("/api/tests/recent-results", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const isBlind = req.user!.isBlindTester === 1;
    const teamId = getActiveTeamId(req);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

    // Reuse the same access-control logic as GET /api/tests
    let allTests: any[] = [];
    const seenIds = new Set<number>();
    if (u.isScopeAdmin) {
      const all = await storage.listAllTestsForTeam(teamId);
      for (const t of all) { allTests.push(t); seenIds.add(t.id); }
    } else {
      if (u.permissions.tests !== "none") {
        const scopedTests = await storage.listTests(u.groupScope, false, teamId);
        for (const t of scopedTests) {
          if (!seenIds.has(t.id) && (t as any).testSkiSource !== "raceskis") { allTests.push(t); seenIds.add(t.id); }
        }
      }
      if (u.permissions.raceskis !== "none") {
        const athleteIds = await storage.listAthleteIdsForUser(u.id);
        if (athleteIds.length > 0) {
          const allTeamTests = await storage.listAllTestsForTeam(teamId);
          for (const t of allTeamTests) {
            if (!seenIds.has(t.id) && (t as any).testSkiSource === "raceskis" && (t as any).athleteId && athleteIds.includes((t as any).athleteId)) {
              allTests.push(t); seenIds.add(t.id);
            }
          }
        }
      }
    }
    if (u.permissions.grinding === "none") {
      allTests = allTests.filter((t: any) => t.testType !== "Grind");
    }
    const allTestIds = allTests.map((t: any) => t.id);
    if (allTestIds.length === 0) return res.json([]);
    const allEntries = await storage.listAllEntriesForTests(allTestIds);

    const latestEntryByTest: Record<number, string> = {};
    for (const e of allEntries) {
      const tid = (e as any).testId;
      const cat = (e as any).createdAt || "";
      if (!latestEntryByTest[tid] || cat > latestEntryByTest[tid]) {
        latestEntryByTest[tid] = cat;
      }
    }

    const testsWithResults = allTests.filter((t: any) => latestEntryByTest[t.id]);
    testsWithResults.sort((a: any, b: any) => (latestEntryByTest[b.id] || "").localeCompare(latestEntryByTest[a.id] || ""));
    const sorted = testsWithResults.slice(0, limit);

    const sortedIds = new Set(sorted.map((t: any) => t.id));
    const entries = allEntries.filter((e: any) => sortedIds.has(e.testId));

    const productIds = new Set<number>();
    for (const e of entries) {
      if ((e as any).productId) productIds.add((e as any).productId);
    }
    const productMap: Record<number, any> = {};
    for (const pid of productIds) {
      const p = await storage.getProduct(pid);
      if (p) productMap[pid] = { id: p.id, brand: p.brand, name: p.name, category: p.category };
    }
    // Winner ski IDs for athlete race-ski tests — the dashboard shows the
    // pair's actual Ski ID, never an anonymous "Pair X".
    const winnerRaceSkiIds = [...new Set(entries.filter((e: any) => e.rank0km === 1 && (e as any).raceSkiId).map((e: any) => (e as any).raceSkiId))];
    const skiIdMap: Record<number, string> = {};
    if (winnerRaceSkiIds.length > 0) {
      const { pool: pRR } = await import("./db");
      const rr = await (pRR as any).query(`SELECT id, ski_id FROM race_skis WHERE id = ANY($1::int[])`, [winnerRaceSkiIds]);
      for (const row of rr.rows) skiIdMap[row.id] = row.ski_id;
    }
    // Grind tests: the winner IS the grind — resolve winning grind profiles.
    const winnerGrindIds = [...new Set(entries.filter((e: any) => e.rank0km === 1 && (e as any).grindProfileId).map((e: any) => (e as any).grindProfileId))];
    const grindMap2: Record<number, string> = {};
    if (winnerGrindIds.length > 0) {
      const { pool: pGr } = await import("./db");
      const gr = await (pGr as any).query(`SELECT id, name, grind_type FROM grind_profiles WHERE id = ANY($1::int[])`, [winnerGrindIds]);
      for (const row of gr.rows) grindMap2[row.id] = [row.name, row.grind_type].filter(Boolean).join(' · ');
    }
    const result = sorted.map((t: any) => {
      const testEntries = entries.filter((e: any) => e.testId === t.id);
      const winner = testEntries.find((e: any) => e.rank0km === 1);
      const winnerProduct = winner && (winner as any).productId ? productMap[(winner as any).productId] : null;
      const entryCount = testEntries.length;
      const hasResults = testEntries.some((e: any) => e.rank0km !== null);
      return {
        id: t.id,
        date: t.date,
        location: t.location,
        testName: (t as any).testName || null,
        testType: t.testType,
        createdByName: t.createdByName,
        createdAt: t.createdAt,
        lastResultAt: latestEntryByTest[t.id] || t.createdAt,
        entryCount,
        hasResults,
        winnerProduct: isBlind ? null : winnerProduct,
        winnerSkiNumber: isBlind ? null : (winner?.skiNumber ?? null),
        winnerSkiId: isBlind ? null : ((winner as any)?.raceSkiId ? skiIdMap[(winner as any).raceSkiId] ?? null : null),
        winnerGrind: isBlind ? null : (
          (winner as any)?.grindProfileId ? grindMap2[(winner as any).grindProfileId] ?? null
          : (winner as any)?.grindType ? [(winner as any).grindType, (winner as any).grindStone].filter(Boolean).join(' · ')
          : null
        ),
      };
    });
    res.json(result);
  });

  app.get("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const test = await storage.getTest(id);
    if (!test) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!verifyTeamOwnership(test, req)) {
      // Child team reading a shared parent test — read-only, and never a test
      // the parent has hidden.
      const share = await getParentShare(getActiveTeamId(req));
      if (share && share.sharedAreas.includes("tests") && (test as any).teamId === share.parentTeamId && (test as any).testSkiSource !== "raceskis"
          && ((test as any).testType !== "Grind" || share.sharedAreas.includes("grinding"))) {
        const excl = await getChildExclusions(share.parentTeamId);
        if (!excl.tests.has(test.id) && u.permissions.tests !== "none") {
          const { runsheetBracket: _rb2, ...safeTest } = test as any;
          return res.json({ ...safeTest, sharedFromTeam: share.parentName, readOnly: true });
        }
      }
      return res.status(403).json({ message: "Forbidden" });
    }
    // Permissions are enforced retroactively — losing access removes all prior tests
    let hasAccess = false;
    if (u.isScopeAdmin) {
      hasAccess = true;
    } else if ((test as any).testSkiSource === "raceskis") {
      // Raceski test: must have raceskis permission AND athlete access
      if (u.permissions.raceskis !== "none" && (test as any).athleteId) {
        hasAccess = await storage.hasAthleteAccess((test as any).athleteId, u.id, false, getActiveTeamId(req));
      }
    } else {
      // Regular test: must have tests permission AND be in the same group
      if (u.permissions.tests !== "none") {
        hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, test.groupScope);
      }
    }
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    if ((test as any).testType === "Grind" && u.permissions.grinding === "none") {
      return res.status(403).json({ message: "Grinding access required" });
    }
    res.json(test);
  });

  app.post("/api/tests/:id/share", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const testId = parseInt(req.params.id);
    const rawIds = req.body.targetTeamIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ message: "targetTeamIds must be a non-empty array" });
    }
    const targetTeamIds = [...new Set(rawIds.map(Number).filter((n: number) => !isNaN(n) && n > 0))] as number[];
    if (targetTeamIds.length === 0) {
      return res.status(400).json({ message: "targetTeamIds must contain valid team IDs" });
    }
    const sourceTest = await storage.getTest(testId);
    if (!sourceTest) return res.status(404).json({ message: "Test not found" });
    const sourceEntries = await storage.listEntries(testId);
    const now = new Date().toISOString();
    const sharedTeamNames: string[] = [];
    const sharerName = `Shared by ${u.name}`;
    const sharerId = u.id;

    const allProductIds = new Set<number>();
    for (const entry of sourceEntries) {
      if (entry.productId) allProductIds.add(entry.productId);
      if (entry.additionalProductIds) {
        for (const idStr of entry.additionalProductIds.split(",")) {
          const id = parseInt(idStr.trim(), 10);
          if (!isNaN(id) && id > 0) allProductIds.add(id);
        }
      }
    }
    const sourceProducts = new Map<number, any>();
    for (const pid of allProductIds) {
      const p = await storage.getProduct(pid);
      if (p) sourceProducts.set(pid, p);
    }

    for (const targetTeamId of targetTeamIds) {
      if (targetTeamId === sourceTest.teamId) continue;
      const team = await storage.getTeam(targetTeamId);
      if (!team) continue;
      const teamGroups = await storage.listGroups(targetTeamId);
      const defaultGroup = teamGroups.length > 0 ? teamGroups[0].name : "default";

      const existingProducts = await storage.listProducts("", true, targetTeamId);
      const productIdMap = new Map<number, number>();

      await db.transaction(async (tx) => {
        for (const [sourceId, srcProd] of sourceProducts) {
          const match = existingProducts.find(
            (ep) => ep.brand === srcProd.brand && ep.name === srcProd.name && ep.category === srcProd.category
          );
          if (match) {
            productIdMap.set(sourceId, match.id);
          } else {
            const [newProd] = await tx.insert(products).values({
              category: srcProd.category,
              brand: srcProd.brand,
              name: srcProd.name,
              createdAt: now,
              createdById: sharerId,
              createdByName: sharerName,
              groupScope: defaultGroup,
              teamId: targetTeamId,
              stockQuantity: 0,
            }).returning();
            productIdMap.set(sourceId, newProd.id);
            existingProducts.push(newProd);
          }
        }

        let newWeatherId: number | null = null;
        if (sourceTest.weatherId) {
          const srcWeather = await storage.getWeather(sourceTest.weatherId);
          if (srcWeather) {
            const [newW] = await tx.insert(dailyWeather).values({
              date: srcWeather.date,
              time: srcWeather.time,
              location: srcWeather.location,
              snowTemperatureC: srcWeather.snowTemperatureC,
              airTemperatureC: srcWeather.airTemperatureC,
              snowHumidityPct: srcWeather.snowHumidityPct,
              airHumidityPct: srcWeather.airHumidityPct,
              clouds: srcWeather.clouds ?? null,
              visibility: srcWeather.visibility || null,
              wind: srcWeather.wind || null,
              precipitation: srcWeather.precipitation || null,
              artificialSnow: srcWeather.artificialSnow || null,
              naturalSnow: srcWeather.naturalSnow || null,
              grainSize: srcWeather.grainSize || null,
              snowHumidityType: srcWeather.snowHumidityType || null,
              trackHardness: srcWeather.trackHardness || null,
              testQuality: srcWeather.testQuality ?? null,
              snowType: srcWeather.snowType || null,
              createdAt: now,
              createdById: sharerId,
              createdByName: sharerName,
              groupScope: defaultGroup,
              teamId: targetTeamId,
            }).returning();
            newWeatherId = newW.id;
          }
        }

        const [newTest] = await tx.insert(tests).values({
          date: sourceTest.date,
          location: sourceTest.location,
          testName: sourceTest.testName || null,
          weatherId: newWeatherId,
          testType: sourceTest.testType,
          testSkiSource: sourceTest.testSkiSource || "series",
          seriesId: null,
          athleteId: null,
          notes: sourceTest.notes || null,
          grindParameters: sourceTest.grindParameters || null,
          distanceLabel0km: sourceTest.distanceLabel0km || null,
          distanceLabelXkm: sourceTest.distanceLabelXkm || null,
          distanceLabels: sourceTest.distanceLabels || null,
          createdAt: now,
          createdById: sharerId,
          createdByName: sharerName,
          groupScope: defaultGroup,
          teamId: targetTeamId,
        }).returning();

        for (const entry of sourceEntries) {
          const mappedProductId = entry.productId ? (productIdMap.get(entry.productId) || null) : null;
          let mappedAdditionalIds: string | null = null;
          if (entry.additionalProductIds) {
            const mapped = entry.additionalProductIds.split(",").map((s) => {
              const id = parseInt(s.trim(), 10);
              return !isNaN(id) && id > 0 ? (productIdMap.get(id) || id) : id;
            });
            mappedAdditionalIds = mapped.join(",");
          }

          await tx.insert(testEntries).values({
            testId: newTest.id,
            skiNumber: entry.skiNumber,
            productId: mappedProductId,
            additionalProductIds: mappedAdditionalIds,
            freeTextProduct: entry.freeTextProduct || null,
            methodology: entry.methodology || "",
            result0kmCmBehind: entry.result0kmCmBehind ?? null,
            rank0km: entry.rank0km ?? null,
            resultXkmCmBehind: entry.resultXkmCmBehind ?? null,
            rankXkm: entry.rankXkm ?? null,
            results: entry.results || null,
            feelingRank: entry.feelingRank ?? null,
            kickRank: entry.kickRank ?? null,
            grindType: entry.grindType || null,
            grindStone: entry.grindStone || null,
            grindPattern: entry.grindPattern || null,
            grindExtraParams: entry.grindExtraParams || null,
            raceSkiId: null,
            createdAt: now,
            createdById: sharerId,
            createdByName: sharerName,
            groupScope: defaultGroup,
            teamId: targetTeamId,
          });
        }
      });
      sharedTeamNames.push(team.name);
      // Access transparency: data leaving one team for another is logged in
      // BOTH teams' activity logs — the same principle as SA team access.
      // Never suppressed by incognito: silent data movement is not acceptable.
      try {
        const nowLog = new Date().toISOString();
        const srcTeam = await storage.getTeam((sourceTest as any).teamId);
        await storage.createActivityLog({
          userId: u.id, userName: u.name, action: "test_shared_out",
          entityType: "test", entityId: testId,
          details: `Test "${sourceTest.testName ?? sourceTest.location}" (${sourceTest.date}) shared to ${team.name}`,
          createdAt: nowLog, groupScope: "", teamId: (sourceTest as any).teamId,
        } as any);
        await storage.createActivityLog({
          userId: u.id, userName: u.name, action: "test_shared_in",
          entityType: "test", entityId: testId,
          details: `Test "${sourceTest.testName ?? sourceTest.location}" (${sourceTest.date}) received from ${srcTeam?.name ?? "another team"} — shared by Glidr support`,
          createdAt: nowLog, groupScope: "", teamId: targetTeamId,
        } as any);
      } catch (e) { console.error("[share-log] failed:", e); }
    }
    res.json({ success: true, sharedTeams: sharedTeamNames });
  });

  app.put("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    // Creator can always edit their own test
    let hasAccess = (existing as any).createdById === u.id;
    if (!hasAccess) hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope) && u.permissions.tests === "edit";
    if (!hasAccess && (existing as any).testSkiSource === "raceskis" && (existing as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((existing as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const testSkiSource = req.body.testSkiSource === "raceskis" ? "raceskis" : (existing as any).testSkiSource || "series";
    const raceOnly = ["Classic", "Skating", "Double Poling", "Mix"];
    const seriesOnly = ["Glide", "Structure", "Grind"];
    if (testSkiSource === "raceskis" && seriesOnly.includes(req.body.testType)) {
      return res.status(400).json({ message: "Race ski tests only allow Classic, Skating, or Double Poling" });
    }
    if (testSkiSource !== "raceskis" && raceOnly.includes(req.body.testType)) {
      return res.status(400).json({ message: "Classic/Skating/Double Poling are only for race ski tests" });
    }
    const testData: any = {
      date: req.body.date,
      location: req.body.location?.trim(),
      testName: req.body.testName !== undefined ? (req.body.testName?.trim() || null) : undefined,
      weatherId: req.body.weatherId || null,
      ...(req.body.noWeather !== undefined ? { noWeather: req.body.noWeather ? 1 : 0 } : {}),
      testType: req.body.testType,
      seriesId: testSkiSource === "raceskis" ? null : req.body.seriesId,
      testSkiSource,
      notes: req.body.notes?.trim() || null,
      distanceLabel0km: req.body.distanceLabel0km?.trim() || null,
      distanceLabelXkm: req.body.distanceLabelXkm?.trim() || null,
      distanceLabels: req.body.distanceLabels || null,
      grindParameters: req.body.grindParameters ?? null,
      startTime: req.body.startTime?.trim() || null,
    };
    if (req.body.groupScope) testData.groupScope = req.body.groupScope;

    if (req.body.entries && testSkiSource === "raceskis") {
      const raceSkiIds = req.body.entries.map((e: any) => e.raceSkiId).filter(Boolean);
      if (raceSkiIds.length > 0) {
        const allowedSkis = await storage.listAllRaceSkisForUser(u.id, u.isScopeAdmin, getActiveTeamId(req));
        const allowedIds = new Set(allowedSkis.map((s: any) => s.id));
        // Team fleet skis (no athlete) are open to every raceskis-level user.
        try {
          const { pool: pgFl } = await import("./db");
          const fl = await (pgFl as any).query(
            `SELECT rs.id FROM race_skis rs JOIN athletes a ON a.id = rs.athlete_id AND a.is_fleet = 1
             WHERE a.team_id = $1`, [getActiveTeamId(req)]);
          for (const row of fl.rows) allowedIds.add(row.id);
        } catch { /* additive */ }
        for (const rsId of raceSkiIds) {
          if (!allowedIds.has(rsId)) {
            return res.status(403).json({ message: "Access denied to race ski " + rsId });
          }
        }
      }
    }

    const updated = await storage.updateTest(id, testData);
    await recordChange(req, "test", id, `Test edited: ${(existing as any).testName || existing.location} (${existing.date})`, existing, updated);

    // Unit may be edited (feature-gated); ranks follow the EFFECTIVE unit.
    let effectiveUnit = (existing as any).resultUnit ?? "cm";
    if (req.body.resultUnit === "time" || req.body.resultUnit === "cm") {
      if (req.body.resultUnit === "time" && !(await teamHasFeature(getActiveTeamId(req), "time_tests"))) {
        // silently keep the stored unit for teams without the feature
      } else {
        effectiveUnit = req.body.resultUnit;
        await (await import("./db")).pool.query(
          `UPDATE tests SET result_unit = $1 WHERE id = $2`, [effectiveUnit, id]).catch(() => {});
      }
    }
    if (req.body.entries) {
      if ((existing as any).testSkiSource === "raceskis") {
        req.body.entries = req.body.entries.filter((e: any) => e.raceSkiId || e.freeTextProduct
          || e.result0kmCmBehind != null || e.feelingRank != null
          || (Array.isArray(e.results) && e.results.some((r: any) => r?.result != null)));
      }
      if (effectiveUnit === "time") applyAvgRanks(req.body.entries);
      await storage.deleteEntriesByTestId(id);
      const now = new Date().toISOString();
      const groupScope = req.body.groupScope || existing.groupScope;
      const teamId = getActiveTeamId(req);
      for (const e of req.body.entries) {
        await storage.createEntry({
          testId: id,
          skiNumber: e.skiNumber,
          productId: e.productId || null,
          freeTextProduct: e.freeTextProduct || null,
          additionalProductIds: e.additionalProductIds || null,
          methodology: e.methodology || "",
          result0kmCmBehind: e.result0kmCmBehind ?? null,
          rank0km: e.rank0km ?? null,
          resultXkmCmBehind: e.resultXkmCmBehind ?? null,
          rankXkm: e.rankXkm ?? null,
          results: e.results || null,
          feelingRank: e.feelingRank ?? null,
          feelingNote: e.feelingNote ?? null,
          kickRank: e.kickRank ?? null,
          kickSolution: e.kickSolution ?? null,
          grindType: e.grindType || null,
          grindStone: e.grindStone || null,
          grindPattern: e.grindPattern || null,
          grindExtraParams: e.grindExtraParams || null,
          grindProfileId: e.grindProfileId || null,
          raceSkiId: e.raceSkiId || null,
          createdAt: now,
          createdById: u.id,
          createdByName: u.name,
          groupScope,
          teamId,
        });
      }
    }

    await stampEdit("tests", id, req);
    res.json(updated);
  });

  // Lightweight weather attach/skip for the "missing weather" dashboard flow —
  // sets ONLY weather_id / no_weather without touching any other test fields.
  app.patch("/api/tests/:id/weather", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    let hasAccess = (existing as any).createdById === u.id;
    if (!hasAccess) hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope) && u.permissions.tests === "edit";
    if (!hasAccess && (existing as any).testSkiSource === "raceskis" && (existing as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((existing as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const noWeather = req.body.noWeather ? 1 : 0;
    const weatherId = noWeather ? null : (req.body.weatherId ? parseInt(req.body.weatherId) : null);
    await (pool as any).query(`UPDATE tests SET weather_id = $1, no_weather = $2 WHERE id = $3`, [weatherId, noWeather, id]);
    await stampEdit("tests", id, req);
    res.json({ ok: true });
  });

  // Feeling test: waxers rank ski pairs (1..N) + optional comment → test_entries.feeling_rank / feeling_note
  app.patch("/api/tests/:id/feeling", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    // Same rules as other test mutations: edit rights on tests, matching group
    // scope, and never for read-only athlete-access accounts.
    if ((req.user as any).isAthleteAccess === 1) return res.status(403).json({ message: "Read-only account" });
    const uF = userInfo(req);
    const { pool } = await import("./db");
    const t = await (pool as any).query(`SELECT id, group_scope, test_ski_source, athlete_id FROM tests WHERE id = $1 AND team_id = $2`, [testId, teamId]);
    if (!t.rows.length) return res.status(404).json({ message: "Not found" });
    let mayEdit = uF.permissions.tests === "edit" && userHasGroupAccess(uF.groupScope, uF.isScopeAdmin, t.rows[0].group_scope || "");
    if (!mayEdit && t.rows[0].test_ski_source === "raceskis" && t.rows[0].athlete_id) {
      mayEdit = await storage.hasAthleteAccess(t.rows[0].athlete_id, uF.id, uF.isScopeAdmin, teamId);
    }
    if (!mayEdit) return res.status(403).json({ message: "Forbidden" });
    const rankings = Array.isArray(req.body.rankings) ? req.body.rankings : [];
    for (const r of rankings) {
      await (pool as any).query(
        `UPDATE test_entries SET feeling_rank = $1, feeling_note = $2 WHERE id = $3 AND test_id = $4`,
        [r.feelingRank ?? null, r.feelingNote || null, parseInt(r.entryId), testId]
      );
    }
    await stampEdit("tests", testId, req);
    res.json({ ok: true });
  });

  app.patch("/api/tests/:id/runsheet-results", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    const canEditTests = userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope) && (u.permissions.tests === "edit" || u.permissions.tests === "view");
    let hasAccess = canEditTests;
    if (!hasAccess && (existing as any).testSkiSource === "raceskis" && (existing as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((existing as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    const results = req.body.results;
    const bracket = req.body.bracket;
    if (!Array.isArray(results)) return res.status(400).json({ message: "results array required" });
    for (const r of results) {
      if (typeof r.skiNumber !== "number" || (r.diff !== null && r.diff !== undefined && typeof r.diff !== "number") || (r.rank !== null && r.rank !== undefined && typeof r.rank !== "number")) {
        return res.status(400).json({ message: "Invalid result item: skiNumber (number), diff (number|null), rank (number|null) required" });
      }
    }

    const entries = await storage.listEntries(id);
    const entryBySkiNumber = new Map(entries.map((e: any) => [e.skiNumber, e]));

    for (const r of results) {
      const entry = entryBySkiNumber.get(r.skiNumber);
      if (!entry) continue;
      await storage.updateEntryResults((entry as any).id, r.diff ?? null, r.rank ?? null);
    }

    if (Array.isArray(bracket)) {
      await db.update(tests).set({ runsheetBracket: JSON.stringify(bracket) }).where(eq(tests.id, id));
    }

    if (!isIncognito(req)) {
      await storage.createActivityLog({
        userId: u.id,
        userName: u.name,
        action: "runsheet_applied",
        entityType: "test",
        entityId: id,
        details: `Applied runsheet results to test ${existing.location} (${existing.date})`,
        createdAt: new Date().toISOString(),
        groupScope: existing.groupScope,
        teamId: getActiveTeamId(req),
      });
    }

    await stampEdit("tests", id, req);
    res.json({ success: true });
  });

  app.get("/api/tests/:id/runsheet-progress", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const u = userInfo(req);
    const row = await db.select().from(runsheetProgress).where(
      and(
        eq(runsheetProgress.testId, testId),
        eq(runsheetProgress.userId, u.id),
        sql`${runsheetProgress.completedAt} IS NULL`
      )
    ).limit(1);
    if (row.length === 0) return res.json(null);
    try {
      res.json({ bracket: JSON.parse(row[0].bracket), updatedAt: row[0].updatedAt });
    } catch {
      res.json(null);
    }
  });

  app.put("/api/tests/:id/runsheet-progress", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const u = userInfo(req);
    // Progress rows surface in the test's team's Live Runsheets — never allow
    // writing progress onto another team's test.
    const rpTest = await storage.getTest(testId);
    if (!rpTest) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(rpTest, req)) return res.status(403).json({ message: "Forbidden" });
    const { bracket } = req.body;
    if (!Array.isArray(bracket)) return res.status(400).json({ message: "bracket array required" });
    const now = new Date().toISOString();
    const bracketJson = JSON.stringify(bracket);
    const existing = await db.select({ id: runsheetProgress.id }).from(runsheetProgress).where(
      and(eq(runsheetProgress.testId, testId), eq(runsheetProgress.userId, u.id))
    ).limit(1);
    if (existing.length > 0) {
      await db.update(runsheetProgress)
        .set({ bracket: bracketJson, updatedAt: now, completedAt: null })
        .where(eq(runsheetProgress.id, existing[0].id));
    } else {
      await db.insert(runsheetProgress).values({
        testId,
        userId: u.id,
        bracket: bracketJson,
        updatedAt: now,
        completedAt: null,
      });
    }
    res.json({ ok: true });
  });

  app.post("/api/tests/:id/runsheet-progress/complete", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const u = userInfo(req);
    const now = new Date().toISOString();
    await db.update(runsheetProgress)
      .set({ completedAt: now, updatedAt: now })
      .where(and(eq(runsheetProgress.testId, testId), eq(runsheetProgress.userId, u.id)));
    res.json({ ok: true });
  });

  app.delete("/api/tests/:id/runsheet-progress", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const u = userInfo(req);
    await db.delete(runsheetProgress).where(
      and(eq(runsheetProgress.testId, testId), eq(runsheetProgress.userId, u.id))
    );
    res.json({ ok: true });
  });

  app.get("/api/live-runsheets", requireAuth, requirePermission("liverunsheets", "view"), async (req, res) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const rows = await db
        .select({
          id: runsheetProgress.id,
          testId: runsheetProgress.testId,
          userId: runsheetProgress.userId,
          bracket: runsheetProgress.bracket,
          updatedAt: runsheetProgress.updatedAt,
          completedAt: runsheetProgress.completedAt,
          userName: users.name,
          testDate: tests.date,
          testLocation: tests.location,
          testName: tests.testName,
          testType: tests.testType,
          seriesId: tests.seriesId,
          testSkiSource: tests.testSkiSource,
        })
        .from(runsheetProgress)
        .innerJoin(users, eq(users.id, runsheetProgress.userId))
        .innerJoin(tests, eq(tests.id, runsheetProgress.testId))
        .where(sql`${runsheetProgress.updatedAt} >= ${todayIso} AND ${tests.teamId} = ${getActiveTeamId(req)}`);

      const seriesIds = [...new Set(rows.filter(r => r.seriesId).map(r => r.seriesId!))];
      let seriesMap: Record<number, { name: string; pairLabels: string | null }> = {};
      if (seriesIds.length > 0) {
        const seriesList = await db
          .select({ id: testSkiSeries.id, name: testSkiSeries.name, pairLabels: testSkiSeries.pairLabels })
          .from(testSkiSeries)
          .where(inArray(testSkiSeries.id, seriesIds));
        for (const s of seriesList) {
          seriesMap[s.id] = { name: s.name, pairLabels: s.pairLabels };
        }
      }

      const result = rows.map(r => {
        let bracket: any = null;
        try { bracket = JSON.parse(r.bracket); } catch {}
        let pairLabels: Record<string, string> | null = null;
        const seriesInfo = r.seriesId ? seriesMap[r.seriesId] : null;
        const rawPl = seriesInfo?.pairLabels;
        try { if (rawPl) pairLabels = JSON.parse(rawPl); } catch {}
        return {
          id: r.id,
          testId: r.testId,
          userId: r.userId,
          userName: r.userName,
          testDate: r.testDate,
          testLocation: r.testLocation,
          testName: r.testName,
          testType: r.testType,
          seriesName: seriesInfo?.name || null,
          testSkiSource: r.testSkiSource,
          pairLabels,
          bracket,
          updatedAt: r.updatedAt,
          completedAt: r.completedAt,
        };
      });

      // Also include active watch sessions that were started from the Watch Queue today
      try {
        const todayIsoStr = todayIso;
        const watchRows = await db
          .select({
            code: watchSessions.code,
            testId: watchSessions.testId,
            userId: watchSessions.userId,
            userName: watchSessions.userName,
            operatorName: watchSessions.operatorName,
            teamId: watchSessions.teamId,
            bracket: watchSessions.bracket,
            createdAt: watchSessions.createdAt,
            expiresAt: watchSessions.expiresAt,
            testDate: tests.date,
            testLocation: tests.location,
            testName: tests.testName,
            testType: tests.testType,
            seriesId: tests.seriesId,
            testSkiSource: tests.testSkiSource,
          })
          .from(watchSessions)
          .innerJoin(tests, eq(tests.id, watchSessions.testId!))
          .where(
            sql`${watchSessions.teamId} = ${getActiveTeamId(req)}
              AND ${watchSessions.createdAt} >= ${todayIsoStr}
              AND ${watchSessions.expiresAt} > ${new Date().toISOString()}
              AND ${watchSessions.testId} IS NOT NULL`
          );

        const watchSeriesIds = [...new Set(watchRows.filter(r => r.seriesId).map(r => r.seriesId!))];
        const watchSeriesMap: Record<number, { name: string; pairLabels: string | null }> = {};
        if (watchSeriesIds.length > 0) {
          const wSeriesList = await db
            .select({ id: testSkiSeries.id, name: testSkiSeries.name, pairLabels: testSkiSeries.pairLabels })
            .from(testSkiSeries)
            .where(inArray(testSkiSeries.id, watchSeriesIds));
          for (const s of wSeriesList) watchSeriesMap[s.id] = { name: s.name, pairLabels: s.pairLabels };
        }

        // Also pull in-memory sessions not in DB yet (same team, today, has testId)
        const todayMs = new Date(todayIsoStr).getTime();
        const nowMs = Date.now();
        const teamIdNum = getActiveTeamId(req);
        const seenCodes = new Set(watchRows.map(r => r.code));
        for (const [code, ws] of watchSessionsMemory.entries()) {
          if (ws.teamId !== teamIdNum) continue;
          if (ws.createdAt < todayMs) continue;
          if (!ws.testId) continue;
          // Check not expired
          if (seenCodes.has(code)) continue;
          seenCodes.add(code);
          // Fetch test info for this session
          try {
            const tRows = await db.select({ date: tests.date, location: tests.location, testName: tests.testName, testType: tests.testType, seriesId: tests.seriesId, testSkiSource: tests.testSkiSource })
              .from(tests).where(eq(tests.id, ws.testId));
            if (tRows[0]) {
              const t = tRows[0];
              let wPairLabels: Record<string, string> | null = null;
              if (ws.skiLabels) {
                wPairLabels = Object.fromEntries(Object.entries(ws.skiLabels).map(([k, v]) => [k, String(v)]));
              }
              result.push({
                id: -(code as any), // negative numeric id to distinguish
                testId: ws.testId,
                userId: ws.userId,
                userName: ws.userName,
                operatorName: ws.operatorName ?? null,
                testDate: t.date,
                testLocation: t.location ?? "",
                testName: t.testName,
                testType: t.testType,
                seriesName: t.seriesId ? (watchSeriesMap[t.seriesId]?.name ?? null) : null,
                testSkiSource: t.testSkiSource ?? "series",
                pairLabels: wPairLabels,
                bracket: ws.bracket,
                updatedAt: new Date(ws.createdAt).toISOString(),
                completedAt: null,
                isWatchSession: true,
              });
            }
          } catch (_) {}
        }

        for (const wr of watchRows) {
          let wBracket: any = null;
          try { wBracket = JSON.parse(wr.bracket); } catch {}
          const wSeriesInfo = wr.seriesId ? watchSeriesMap[wr.seriesId] : null;
          let wPairLabels: Record<string, string> | null = null;
          try {
            if (wSeriesInfo?.pairLabels) wPairLabels = JSON.parse(wSeriesInfo.pairLabels);
          } catch {}
          // Avoid duplicates if already added from memory
          const existingIdx = result.findIndex(r => r.testId === wr.testId && r.userName === wr.userName && (r as any).isWatchSession);
          if (existingIdx >= 0) continue;
          result.push({
            id: -(parseInt(wr.code) || 0),
            testId: wr.testId!,
            userId: wr.userId,
            userName: wr.userName,
            operatorName: (wr as any).operatorName ?? null,
            testDate: wr.testDate,
            testLocation: wr.testLocation ?? "",
            testName: wr.testName,
            testType: wr.testType,
            seriesName: wSeriesInfo?.name ?? null,
            testSkiSource: wr.testSkiSource ?? "series",
            pairLabels: wPairLabels,
            bracket: wBracket,
            updatedAt: wr.createdAt,
            completedAt: null,
            isWatchSession: true,
          });
        }
      } catch (watchErr: any) {
        // Non-fatal — watch session merge is best-effort
        console.warn("live-runsheets watch merge error:", watchErr?.message);
      }

      res.json(result);
    } catch (e: any) {
      console.error("live-runsheets error:", e.stack || e.message || e);
      res.status(500).json({ message: e.message || "Failed to fetch live runsheets" });
    }
  });

  app.delete("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    // Creator can always delete their own test
    let hasAccess = (existing as any).createdById === u.id;
    if (!hasAccess) hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope) && u.permissions.tests === "edit";
    if (!hasAccess && (existing as any).testSkiSource === "raceskis" && (existing as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((existing as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }
    // Snapshot the test AND its result entries before they cascade away.
    const { pool: entPool } = await import("./db");
    const entriesSnap = await (entPool as any).query(`SELECT * FROM test_entries WHERE test_id = $1 ORDER BY ski_number ASC`, [id]).then((r: any) => r.rows).catch(() => []);
    await storage.deleteRunsheetsByTestId(id);
    await storage.deleteTest(id);
    await recordDeletion(req, "test", id, `Test deleted: ${(existing as any).testName || existing.location} (${existing.date})`, { test: existing, entries: entriesSnap });
    res.json({ ok: true });
  });

  // GET /api/tests/:id/attachments
  app.get("/api/tests/:id/attachments", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const test = await storage.getTest(testId);
    if (!test) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(test, req)) return res.status(403).json({ message: "Forbidden" });
    if (!(await canViewTestRecord(test, req))) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT id, test_id, filename, mime_type, created_at, uploaded_by_id FROM test_attachments WHERE test_id = $1 ORDER BY created_at DESC`,
      [testId]
    );
    res.json(result.rows);
  });

  // POST /api/tests/:id/attachments — upload base64 image (R2 or legacy base64)
  app.post("/api/tests/:id/attachments", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    // Ownership: uploads only to tests in the caller's active team.
    const attTest = await storage.getTest(testId);
    if (!attTest) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(attTest, req)) return res.status(403).json({ message: "Forbidden" });
    const { filename, mimeType, data } = req.body;
    if (!filename || !data) return res.status(400).json({ message: "filename and data required" });
    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "application/pdf"];
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ message: "File type not allowed" });
    }
    // Check decoded size (base64 is ~4/3 of binary)
    const approxBytes = Math.ceil((String(data).length * 3) / 4);
    if (approxBytes > 5 * 1024 * 1024) {
      return res.status(413).json({ message: "File too large (max 5 MB)" });
    }
    const u = userInfo(req);
    const { pool } = await import("./db");
    const now = new Date().toISOString();
    const mime = mimeType || "image/jpeg";

    if (r2Enabled) {
      // Decode base64 payload and upload to R2
      const base64 = String(data).replace(/^data:[^;]+;base64,/, "");
      const buf = Buffer.from(base64, "base64");
      const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
      const { randomUUID } = await import("crypto");
      const key = `attachments/${testId}/${randomUUID()}.${ext}`;
      const uploadedKey = await uploadToR2(key, buf, mime);
      if (!uploadedKey) {
        return res.status(500).json({ message: "R2 upload failed" });
      }
      const result = await (pool as any).query(
        `INSERT INTO test_attachments (test_id, filename, mime_type, data, url, created_at, uploaded_by_id) VALUES ($1,$2,$3,'',$4,$5,$6) RETURNING id, test_id, filename, mime_type, url, created_at`,
        [testId, filename, mime, uploadedKey, now, u.id]
      );
      return res.json(result.rows[0]);
    }

    // Legacy: store base64 in the data column
    const result = await (pool as any).query(
      `INSERT INTO test_attachments (test_id, filename, mime_type, data, created_at, uploaded_by_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, test_id, filename, mime_type, created_at`,
      [testId, filename, mime, data, now, u.id]
    );
    res.json(result.rows[0]);
  });

  // GET /api/attachments/:id — serve raw image (redirect to R2 URL or stream legacy base64)
  app.get("/api/attachments/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    const result = await (pool as any).query(`SELECT filename, mime_type, data, url, test_id FROM test_attachments WHERE id = $1`, [id]);
    if (!result.rows[0]) return res.status(404).json({ message: "Not found" });
    const { filename, mime_type, data, url, test_id } = result.rows[0];
    // Verify caller belongs to the same team as the parent test
    const parentTest = await storage.getTest(test_id);
    if (!parentTest || !verifyTeamOwnership(parentTest, req)) return res.status(403).json({ message: "Forbidden" });
    if (!(await canViewTestRecord(parentTest, req))) return res.status(403).json({ message: "Forbidden" });

    // R2 path: url column holds the object key; resolve to signed/public URL and redirect
    if (url) {
      const signedUrl = await getR2Url(url);
      if (!signedUrl) return res.status(500).json({ message: "Could not generate download URL" });
      return res.redirect(302, signedUrl);
    }

    // Legacy path: decode base64 and stream directly
    const buf = Buffer.from(String(data).replace(/^data:[^;]+;base64,/, ""), "base64");
    res.setHeader("Content-Type", mime_type);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buf);
  });

  // ─── Watch-app distribution (#19–21) ────────────────────────────────────────
  // Whether the caller may download the watch-app file: SA always; a Team Admin
  // only if their active team has been granted the "download watch-app" permission.
  async function canDownloadWatchApp(req: Request): Promise<boolean> {
    const u = req.user as any;
    if (u?.isAdmin === 1) return true;
    if (u?.isTeamAdmin !== 1) return false;
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const r = await (pool as any).query(`SELECT watch_app_download FROM teams WHERE id = $1`, [teamId]);
    return r.rows[0]?.watch_app_download === 1;
  }

  // SA uploads (or replaces) the watch-app file. Kept as newest row.
  app.post("/api/watch-app", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const { filename, mimeType, data, version, notes } = req.body;
    if (!filename || !data) return res.status(400).json({ message: "filename and data required" });
    // The global JSON body limit is 5 MB; base64 inflates ~4/3, so the binary
    // must stay under ~3.5 MB (watch-app files are small).
    const approxBytes = Math.ceil((String(data).length * 3) / 4);
    if (approxBytes > 3.5 * 1024 * 1024) return res.status(413).json({ message: "File too large (max 3.5 MB)" });
    const { pool } = await import("./db");
    const now = new Date().toISOString();
    const mime = mimeType || "application/octet-stream";
    if (r2Enabled) {
      const base64 = String(data).replace(/^data:[^;]+;base64,/, "");
      const buf = Buffer.from(base64, "base64");
      const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
      const { randomUUID } = await import("crypto");
      const key = `watch-app/${randomUUID()}.${ext}`;
      const uploadedKey = await uploadToR2(key, buf, mime);
      if (!uploadedKey) return res.status(500).json({ message: "R2 upload failed" });
      await (pool as any).query(
        `INSERT INTO watch_app (filename, mime_type, data, url, version, notes, uploaded_at, uploaded_by_id, uploaded_by_name) VALUES ($1,$2,'',$3,$4,$5,$6,$7,$8)`,
        [filename, mime, uploadedKey, version || null, notes || null, now, u.id, u.name]
      );
    } else {
      await (pool as any).query(
        `INSERT INTO watch_app (filename, mime_type, data, version, notes, uploaded_at, uploaded_by_id, uploaded_by_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [filename, mime, data, version || null, notes || null, now, u.id, u.name]
      );
    }
    res.json({ ok: true });
  });

  // Metadata about the current watch-app file + whether the caller may download it.
  app.get("/api/watch-app/meta", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT id, filename, version, notes, uploaded_at AS "uploadedAt", uploaded_by_name AS "uploadedByName" FROM watch_app ORDER BY id DESC LIMIT 1`
    );
    const canDownload = await canDownloadWatchApp(req);
    res.json({ file: r.rows[0] ?? null, canDownload });
  });

  // Download the current watch-app file (logs the download for the SA overview).
  app.get("/api/watch-app/download", requireAuth, async (req, res) => {
    if (!(await canDownloadWatchApp(req))) return res.status(403).json({ message: "No permission to download the watch app" });
    const { pool } = await import("./db");
    const r = await (pool as any).query(`SELECT id, filename, mime_type, data, url FROM watch_app ORDER BY id DESC LIMIT 1`);
    const row = r.rows[0];
    if (!row) return res.status(404).json({ message: "No watch-app file uploaded yet" });
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const team = await storage.getTeam(teamId);
    await (pool as any).query(
      `INSERT INTO watch_app_downloads (watch_app_id, team_id, team_name, user_id, user_name, downloaded_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [row.id, teamId, team?.name ?? null, u.id, u.name, new Date().toISOString()]
    ).catch(() => {});
    if (row.url) {
      const signedUrl = await getR2Url(row.url);
      if (!signedUrl) return res.status(500).json({ message: "Could not generate download URL" });
      return res.redirect(302, signedUrl);
    }
    const buf = Buffer.from(String(row.data).replace(/^data:[^;]+;base64,/, ""), "base64");
    res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${row.filename}"`);
    res.send(buf);
  });

  // SA overview: who has downloaded the watch app, newest first.
  app.get("/api/watch-app/downloads", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT id, team_id AS "teamId", team_name AS "teamName", user_id AS "userId", user_name AS "userName", downloaded_at AS "downloadedAt" FROM watch_app_downloads ORDER BY id DESC LIMIT 500`
    );
    res.json(r.rows);
  });

  // SA grants/revokes a team's permission to download the watch app.
  app.put("/api/teams/:id/watch-app-permission", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const id = parseInt(req.params.id);
    const enabled = req.body.enabled ? 1 : 0;
    const { pool } = await import("./db");
    await (pool as any).query(`UPDATE teams SET watch_app_download = $1 WHERE id = $2`, [enabled, id]);
    res.json({ ok: true, enabled: enabled === 1 });
  });

  // GET users who can be @mentioned in a test's comments
  // Filtered to members who have access to the test's group
  app.get("/api/tests/:id/mentionable-users", requireAuth, async (req, res) => {
    const u = req.user as any;
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) return res.status(400).json({ message: "Invalid test id" });
    const teamId = (u.activeTeamId || u.teamId) as number;
    if (!teamId) return res.status(400).json({ message: "No active team" });
    const { pool } = await import("./db");
    try {
      // Fetch the test's group_scope so we can filter members
      const testRow = await (pool as any).query(
        `SELECT group_scope FROM tests WHERE id = $1 AND team_id = $2`,
        [testId, teamId]
      );
      const testGroup: string = testRow.rows[0]?.group_scope ?? "";

      // A user can be mentioned if:
      //   - they are active on this team (primary team_id or via user_team_permissions)
      //   - their group_scope is empty (no restriction) OR contains the test's group
      const result = await (pool as any).query(
        `SELECT DISTINCT u.id, u.name
         FROM users u
         LEFT JOIN user_team_permissions utp
           ON utp.user_id = u.id AND utp.team_id = $1
         WHERE (u.team_id = $1 OR utp.team_id = $1)
           AND u.is_active = 1
           AND u.id != $2
           AND (
             $3 = ''
             OR COALESCE(utp.group_scope, u.group_scope, '') = ''
             OR COALESCE(utp.group_scope, u.group_scope, '') LIKE $4
           )
         ORDER BY u.name`,
        [teamId, u.id, testGroup, `%${testGroup}%`]
      );
      return res.json(result.rows.map((r: any) => ({ id: r.id, name: r.name })));
    } catch (err) {
      console.error("mentionable-users error:", err);
      return res.status(500).json({ message: "Failed to fetch mentionable users" });
    }
  });

  // GET comments for a test
  app.get("/api/tests/:id/comments", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const { pool } = await import("./db");
    // Verify test belongs to this team before returning comments
    const testCheck = await (pool as any).query(
      `SELECT id FROM tests WHERE id = $1 AND team_id = $2`, [testId, teamId]
    );
    if (!testCheck.rows.length) return res.status(404).json({ message: "Not found" });
    {
      const tRec = await storage.getTest(testId);
      if (!tRec || !(await canViewTestRecord(tRec, req))) return res.status(403).json({ message: "Forbidden" });
    }
    const result = await (pool as any).query(
      `SELECT id, test_id, user_id, user_name, content, created_at FROM test_comments WHERE test_id = $1 ORDER BY created_at ASC`,
      [testId]
    );
    return res.json(result.rows);
  });

  // POST a new comment
  app.post("/api/tests/:id/comments", requireAuth, async (req, res) => {
    const u = req.user!;
    const testId = parseInt(req.params.id);
    const content = String(req.body.content ?? "").trim();
    if (!content || content.length > 2000) return res.status(400).json({ message: "Invalid comment" });
    const { pool } = await import("./db");
    // Verify test belongs to this team
    const teamId = ((u as any).activeTeamId || u.teamId) as number;
    const testCheck = await (pool as any).query(
      `SELECT id FROM tests WHERE id = $1 AND team_id = $2`, [testId, teamId]
    );
    if (!testCheck.rows.length) return res.status(404).json({ message: "Not found" });

    const result = await (pool as any).query(
      `INSERT INTO test_comments (test_id, user_id, user_name, content) VALUES ($1,$2,$3,$4) RETURNING *`,
      [testId, u.id, u.name, content]
    );
    const comment = result.rows[0];

    // Notify via inbox: the test owner (any comment on their test) plus anyone
    // @mentioned. Best-effort — never fail the comment POST on a notify error.
    try {
      const teamId = (u as any).activeTeamId || u.teamId;
      const testRow = await (pool as any).query(
        `SELECT test_name, location, date, created_by_id AS "createdById" FROM tests WHERE id = $1`, [testId]);
      const testLabel = testRow.rows[0]?.test_name || testRow.rows[0]?.location || `Test #${testId}`;
      const notified = new Set<number>([u.id]); // never notify the commenter
      const notify = async (toUserId: number, subject: string) => {
        if (notified.has(toUserId)) return;
        notified.add(toUserId);
        await (pool as any).query(
          `INSERT INTO inbox_messages
             (team_id, to_user_id, from_user_id, from_name, subject, body, is_read, created_at, action_type, action_data)
           VALUES ($1,$2,$3,$4,$5,$6,0,NOW(),$7,$8)`,
          [teamId, toUserId, u.id, u.name, subject, content, "test_comment", JSON.stringify({ testId })]);
      };

      // The test owner — a new comment on your test.
      const ownerId = testRow.rows[0]?.createdById;
      if (ownerId) await notify(ownerId, `${u.name} kommenterte «${testLabel}» / commented on "${testLabel}"`);

      // Then @First_Last mentions — underscores represent spaces.
      const uniqueMentions = [...new Set([...content.matchAll(/@([a-zA-Z0-9._-]+)/g)].map(m => m[1].replace(/_/g, " ").toLowerCase()))];
      if (uniqueMentions.length > 0) {
        const mentionedUsers = await (pool as any).query(
          `SELECT id, name FROM users
           WHERE (team_id = $1 OR id IN (SELECT user_id FROM user_team_permissions WHERE team_id = $1))
             AND LOWER(name) = ANY($2) AND id != $3 AND is_active = 1`,
          [teamId, uniqueMentions, u.id]);
        for (const m of mentionedUsers.rows) await notify(m.id, `${u.name} nevnte deg i «${testLabel}» / mentioned you in "${testLabel}"`);
      }
    } catch (e) {
      console.error("Failed to send comment notifications:", e);
    }

    return res.status(201).json(comment);
  });

  // GET PDF data for a test
  app.get("/api/tests/:id/pdf", requireAuth, async (req, res) => {
    try {
      const testId = parseInt(req.params.id);
      if (isNaN(testId)) return res.status(400).json({ message: "Invalid test id" });
      const u = req.user!;
      const { pool } = await import("./db");

      const [testRes, entriesRes, weatherRes] = await Promise.all([
        (pool as any).query(
          `SELECT t.*, s.name as series_name FROM tests t
           LEFT JOIN test_ski_series s ON s.id = t.series_id
           WHERE t.id = $1 AND t.team_id = $2`,
          [testId, u.activeTeamId || u.teamId]
        ),
        (pool as any).query(
          `SELECT te.*, p.brand, p.name as product_name, p.category FROM test_entries te
           LEFT JOIN products p ON p.id = te.product_id
           WHERE te.test_id = $1 ORDER BY COALESCE(te.rank_0km, 999)`,
          [testId]
        ),
        (pool as any).query(
          `SELECT * FROM daily_weather WHERE id = (SELECT weather_id FROM tests WHERE id = $1)`,
          [testId]
        ),
      ]);

      if (!testRes.rows.length) return res.status(404).json({ message: "Not found" });

      // Comments are optional — table may not exist yet on older deployments
      let comments: any[] = [];
      try {
        const commentsRes = await (pool as any).query(
          `SELECT user_name, content, created_at FROM test_comments WHERE test_id = $1 ORDER BY created_at ASC`,
          [testId]
        );
        comments = commentsRes.rows;
      } catch { /* table doesn't exist yet — skip */ }

      // Redact product information for blind testers and athlete access users
      const shouldRedact = u.isBlindTester === 1 || (u as any).isAthleteAccess === 1;
      const entries = shouldRedact
        ? entriesRes.rows.map((e: any) => ({
            ...e,
            product_id: null,
            product_name: null,
            brand: null,
            additional_product_ids: null,
            methodology: null,
          }))
        : entriesRes.rows;

      return res.json({
        test: testRes.rows[0],
        entries,
        weather: weatherRes.rows[0] ?? null,
        comments,
      });
    } catch (err: any) {
      console.error("[/api/tests/:id/pdf]", err);
      return res.status(500).json({ message: err?.message ?? "Internal server error" });
    }
  });

  // POST /api/tests/:id/public-link — generate (or return existing) share token
  app.post("/api/tests/:id/public-link", requireAuth, async (req, res) => {
    try {
      const testId = parseInt(req.params.id);
      if (isNaN(testId)) return res.status(400).json({ message: "Invalid test id" });
      // Verify ownership using Drizzle (teamId is in schema)
      const test = await storage.getTest(testId);
      if (!test) return res.status(404).json({ message: "Not found" });
      if (!verifyTeamOwnership(test, req)) return res.status(403).json({ message: "Forbidden" });
      // Use raw SQL to read/write share_token (not in Drizzle schema)
      const { pool } = await import("./db");
      const tokenRes = await (pool as any).query(`SELECT share_token FROM tests WHERE id = $1`, [testId]);
      const existing = tokenRes.rows[0]?.share_token as string | null;
      if (existing) {
        return res.json({ token: existing, url: `${req.protocol}://${req.get("host")}/share/test/${existing}` });
      }
      const crypto = await import("crypto");
      const token = crypto.randomBytes(20).toString("hex");
      await (pool as any).query(`UPDATE tests SET share_token = $1 WHERE id = $2`, [token, testId]);
      // A public link is data leaving the team — logged like any other export.
      try {
        const uLink = userInfo(req);
        await storage.createActivityLog({
          userId: uLink.id, userName: uLink.name, action: "share_link_created",
          entityType: "test", entityId: testId,
          details: `Public read-only link created for "${test.testName ?? test.location}" (${test.date})`,
          createdAt: new Date().toISOString(), groupScope: "", teamId: (test as any).teamId,
        } as any);
      } catch (e) { console.error("[share-link-log] failed:", e); }
      return res.json({ token, url: `${req.protocol}://${req.get("host")}/share/test/${token}` });
    } catch (err: any) {
      console.error("[/api/tests/:id/public-link]", err);
      return res.status(500).json({ message: err?.message ?? "Internal server error" });
    }
  });

  // GET /api/tests/:id/cross-team — READ-ONLY view of a test that belongs to
  // ANOTHER of the caller's teams. The All teams page lists such tests, so it
  // must also be able to open them; the gate mirrors that list exactly (All
  // teams permission + membership + per-team tests permission + group scope),
  // and the payload is deliberately flat and read-only.
  app.get("/api/tests/:id/cross-team", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const rawUser = req.user as any;
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) return res.status(400).json({ message: "Invalid test id" });
    const test: any = await storage.getTest(testId);
    if (!test) return res.status(404).json({ message: "Not found" });

    const { pool: pX } = await import("./db");
    const memberships = await storage.getUserTeams(u.id);
    const myTeamIds = new Set<number>([u.teamId, ...memberships.map((m: any) => m.teamId)]);
    // Same gate as the All teams list.
    if (!u.isAdmin) {
      if (rawUser.canViewAllTeams !== 1 || myTeamIds.size < 2) {
        return res.status(403).json({ message: "No access to the All teams view" });
      }
      if (!myTeamIds.has(test.teamId)) return res.status(403).json({ message: "Forbidden" });

      // Permissions for the OWNING team: per-team override, else the global set.
      const tp = await (pX as any).query(
        "SELECT permissions, group_scope, is_team_admin FROM user_team_permissions WHERE user_id = $1 AND team_id = $2",
        [u.id, test.teamId]);
      const row = tp.rows[0];
      const isTaThere = row ? row.is_team_admin === 1 : (test.teamId === u.teamId && rawUser.isTeamAdmin === 1);
      const perms = parsePermissions(row?.permissions ?? rawUser.permissions, false, isTaThere);
      if (perms.tests === "none") return res.status(403).json({ message: "Forbidden" });
      if (test.testType === "Grind" && perms.grinding === "none") {
        return res.status(403).json({ message: "Grinding access required" });
      }
      // Athlete ski tests stay behind athlete access.
      if (test.testSkiSource === "raceskis") {
        const ok = test.athleteId
          ? await storage.hasAthleteAccess(test.athleteId, u.id, isTaThere, test.teamId)
          : false;
        if (!ok) return res.status(403).json({ message: "Forbidden" });
      } else if (!isTaThere) {
        const scope = String(row?.group_scope ?? "").trim() || rawUser.groupScope;
        if (!userHasGroupAccess(scope, false, test.groupScope)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }
    }

    const entries = (await (pX as any).query(
      `SELECT te.ski_number AS "skiNumber", te.rank_0km AS "rank0km", te.rank_xkm AS "rankXkm",
              te.result_0km_cm_behind AS "result0km", te.result_xkm_cm_behind AS "resultXkm",
              te.feeling_rank AS "feelingRank", te.feeling_note AS "feelingNote", te.kick_rank AS "kickRank",
              te.kick_solution AS "kickSolution", te.methodology, te.free_text_product AS "freeTextProduct",
              te.grind_type AS "grindType", p.brand, p.name AS "productName", p.category
       FROM test_entries te LEFT JOIN products p ON p.id = te.product_id
       WHERE te.test_id = $1 ORDER BY te.ski_number ASC`, [testId])).rows;
    // Blind testers / athlete-access accounts: strip product identity here too.
    const redactCT = req.user!.isBlindTester === 1 || (req.user as any).isAthleteAccess === 1;
    const safeEntries = redactCT
      ? entries.map((e: any) => ({ ...e, productId: null, additionalProductIds: null, freeTextProduct: null, methodology: null, brand: null, productName: null, category: null }))
      : entries;
    const team = await storage.getTeam(test.teamId);
    const weather = test.weatherId ? await storage.getWeather(test.weatherId) : null;
    const { runsheetBracket: _rb, ...safeTest } = test;
    res.json({ test: safeTest, entries: safeEntries, weather, teamName: team?.name ?? "", readOnly: true });
  });

  // GET /api/tests/share-links — every active public link for this team, so a
  // TA can see what is exposed and pull it back.
  app.get("/api/tests/share-links", requirePermission("tests", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const { pool: pL } = await import("./db");
    const rows = (await (pL as any).query(
      `SELECT id, date, location, test_name AS "testName", share_token AS "token"
       FROM tests WHERE team_id = $1 AND share_token IS NOT NULL ORDER BY date DESC`, [teamId])).rows;
    res.json(rows.map((r: any) => ({ ...r, url: `${req.protocol}://${req.get("host")}/share/test/${r.token}` })));
  });

  // DELETE /api/tests/:id/public-link — revoke the link (token cleared).
  app.delete("/api/tests/:id/public-link", requirePermission("tests", "edit"), async (req, res) => {
    const testId = parseInt(req.params.id);
    const test = await storage.getTest(testId);
    if (!test) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(test, req)) return res.status(403).json({ message: "Forbidden" });
    const { pool: pR } = await import("./db");
    await (pR as any).query(`UPDATE tests SET share_token = NULL WHERE id = $1`, [testId]);
    try {
      const uR = userInfo(req);
      await storage.createActivityLog({
        userId: uR.id, userName: uR.name, action: "share_link_revoked",
        entityType: "test", entityId: testId,
        details: `Public link revoked for "${test.testName ?? test.location}" (${test.date})`,
        createdAt: new Date().toISOString(), groupScope: "", teamId: (test as any).teamId,
      } as any);
    } catch (e) { console.error("[share-link-log] failed:", e); }
    res.json({ ok: true });
  });

  // GET /api/public/test/:token — public read-only test data (no auth)
  app.get("/api/public/test/:token", async (req, res) => {
    try {
      const { token } = req.params;
      if (!token) return res.status(400).json({ message: "Missing token" });
      const { pool } = await import("./db");
      const testRes = await (pool as any).query(
        `SELECT id, date, location, test_name, test_type, notes, distance_label_0km, distance_label_xkm, distance_labels, created_by_name, created_at
         FROM tests WHERE share_token = $1`,
        [token]
      );
      if (!testRes.rows.length) return res.status(404).json({ message: "Not found" });
      const testRow = testRes.rows[0];
      const entriesRes = await (pool as any).query(
        `SELECT te.ski_number, te.rank_0km, te.rank_xkm, te.result_0km_cm_behind, te.result_xkm_cm_behind,
                te.feeling_rank, te.kick_rank, te.methodology, te.free_text_product,
                p.brand, p.name as product_name, p.category
         FROM test_entries te
         LEFT JOIN products p ON p.id = te.product_id
         WHERE te.test_id = $1
         ORDER BY COALESCE(te.rank_0km, 999), te.ski_number`,
        [testRow.id]
      );
      return res.json({ test: testRow, entries: entriesRes.rows });
    } catch (err: any) {
      console.error("[/api/public/test/:token]", err);
      return res.status(500).json({ message: err?.message ?? "Internal server error" });
    }
  });

  // DELETE own comment (or admin)
  app.delete("/api/comments/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    const commentId = parseInt(req.params.id);
    const { pool } = await import("./db");
    const existing = await (pool as any).query(`SELECT user_id FROM test_comments WHERE id = $1`, [commentId]);
    if (!existing.rows.length) return res.status(404).json({ message: "Not found" });
    if (existing.rows[0].user_id !== u.id && !u.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await (pool as any).query(`DELETE FROM test_comments WHERE id = $1`, [commentId]);
    return res.json({ ok: true });
  });

  // Bulk entries: ONE request/query for every test the pages need, replacing
  // the old one-request-per-test fan-out (300 tests × 50 users would have been
  // 15 000 parallel requests). Mirrors the exact access rules of the single
  // endpoint — team, group scope, grind permission, athlete access — and the
  // child-team share layer with curation + recompute.
  app.post("/api/test-entries/bulk", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const ids: number[] = Array.isArray(req.body?.ids)
      ? req.body.ids.map((n: any) => parseInt(String(n))).filter((n: number) => !isNaN(n)).slice(0, 3000)
      : [];
    if (ids.length === 0) return res.json([]);
    const { pool: pB } = await import("./db");
    const tr = await (pB as any).query(
      `SELECT id, team_id, group_scope, test_type, test_ski_source, athlete_id, created_by_id
       FROM tests WHERE id = ANY($1::int[])`, [ids]);
    const share = await getParentShare(teamId);
    const excl = share ? await getChildExclusions(share.parentTeamId) : null;
    // The caller's athlete-access set, loaded once (for race-ski tests).
    const accR = await (pB as any).query(`SELECT athlete_id FROM athlete_access WHERE user_id = $1`, [u.id]);
    const accSet = new Set<number>(accR.rows.map((r: any) => r.athlete_id));

    const own: number[] = [];
    const sharedTests: number[] = [];
    for (const t of tr.rows) {
      if (t.team_id === teamId) {
        let ok = t.created_by_id === u.id
          || (userHasGroupAccess(u.groupScope, u.isScopeAdmin, t.group_scope || "") && u.permissions.tests !== "none");
        if (!ok && t.test_ski_source === "raceskis" && t.athlete_id) ok = u.isScopeAdmin || accSet.has(t.athlete_id);
        if (ok && t.test_type === "Grind" && u.permissions.grinding === "none" && t.created_by_id !== u.id) ok = false;
        if (ok) own.push(t.id);
      } else if (
        share && excl && t.team_id === share.parentTeamId
        && share.sharedAreas.includes("tests")
        && t.test_ski_source !== "raceskis"
        && (t.test_type !== "Grind" || share.sharedAreas.includes("grinding"))
        && !excl.tests.has(t.id)
        && u.permissions.tests !== "none"
      ) {
        sharedTests.push(t.id);
      }
    }

    const out: any[] = [];
    if (own.length > 0) {
      out.push(...await db.select().from(testEntries).where(inArray(testEntries.testId, own)));
    }
    if (sharedTests.length > 0 && excl) {
      const rows = await db.select().from(testEntries).where(inArray(testEntries.testId, sharedTests));
      const byTest = new Map<number, any[]>();
      for (const e of rows) {
        if (!byTest.has(e.testId)) byTest.set(e.testId, []);
        byTest.get(e.testId)!.push(e);
      }
      for (const [tid, all] of byTest) {
        const visible = all.filter((e: any) => !excl.entries.has(e.id) && !(e.productId != null && excl.products.has(e.productId)));
        out.push(...(visible.length !== all.length ? recomputeSharedEntries(visible) : visible));
        void tid;
      }
    }
    // Same product redaction as the single-test endpoint.
    if (req.user!.isBlindTester === 1 || (req.user as any).isAthleteAccess === 1) {
      return res.json(out.map((e: any) => ({ ...e, productId: null, additionalProductIds: null, freeTextProduct: null, methodology: null })));
    }
    res.json(out);
  });

  app.get("/api/tests/:id/entries", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id as string);
    const u = userInfo(req);
    const test = await storage.getTest(testId);
    if (!test) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(test, req)) {
      // Shared parent test → curated, recomputed entry view for the child.
      const share = await getParentShare(getActiveTeamId(req));
      if (share && share.sharedAreas.includes("tests") && (test as any).teamId === share.parentTeamId && (test as any).testSkiSource !== "raceskis" && u.permissions.tests !== "none"
          && ((test as any).testType !== "Grind" || share.sharedAreas.includes("grinding"))) {
        const excl = await getChildExclusions(share.parentTeamId);
        if (!excl.tests.has(test.id)) {
          const all = await storage.listEntries(testId);
          const visible = all.filter((e: any) => !excl.entries.has(e.id) && !(e.productId != null && excl.products.has(e.productId)));
          const changed = visible.length !== all.length;
          let shared = changed ? recomputeSharedEntries(visible) : visible;
          if (req.user!.isBlindTester === 1 || (req.user as any).isAthleteAccess === 1) {
            shared = shared.map((e: any) => ({ ...e, productId: null, additionalProductIds: null, freeTextProduct: null, methodology: null }));
          }
          return res.json(shared);
        }
      }
      return res.status(403).json({ message: "Forbidden" });
    }
    // Own tests always accessible
    let hasAccess = (test as any).createdById === u.id;
    if (!hasAccess) hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, test.groupScope) && u.permissions.tests !== "none";
    if (!hasAccess && (test as any).testSkiSource === "raceskis" && (test as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((test as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if ((test as any).testType === "Grind" && u.permissions.grinding === "none" && (test as any).createdById !== u.id) {
      return res.status(403).json({ message: "Grinding access required" });
    }
    const entries = await storage.listEntries(testId);
    const shouldRedact = req.user!.isBlindTester === 1 || (req.user as any).isAthleteAccess === 1;
    if (shouldRedact) {
      const redacted = entries.map((e: any) => ({
        ...e,
        productId: null,
        additionalProductIds: null,
        freeTextProduct: null,
        methodology: null,
      }));
      return res.json(redacted);
    }
    res.json(entries);
  });

  app.get("/api/users", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getAdminTeamScope(req);
    let list = await storage.listUsers(teamId);
    // Super Admin accounts are never team members — they must not appear in any
    // team's user list. They remain visible only in the SA all-teams system view.
    if (teamId) list = list.filter((u: any) => u.isAdmin !== 1);
    const byId = new Map<number, any>(list.map((u: any) => [u.id, u]));
    // Also include users added to this team via user_team_permissions (their
    // primary team is elsewhere), shown with their per-team role/permissions and
    // flagged so the TA can tell them apart / remove them.
    if (teamId) {
      try {
        const { pool } = await import("./db");
        const extra = await (pool as any).query(
          `SELECT u.id, u.email, u.name, u.username, u.team_id AS "teamId", u.is_admin AS "isAdmin",
                  u.is_blind_tester AS "isBlindTester", u.is_active AS "isActive", u.garmin_watch AS "garminWatch",
                  u.login_locked AS "loginLocked", u.failed_attempts AS "failedAttempts", u.created_at AS "createdAt",
                  u.is_athlete_access AS "isAthleteAccess", u.linked_athlete_id AS "linkedAthleteId",
                  u.can_view_all_teams AS "canViewAllTeams",
                  utp.permissions AS "utpPermissions", utp.group_scope AS "utpGroupScope", utp.is_team_admin AS "utpIsTeamAdmin"
           FROM user_team_permissions utp JOIN users u ON u.id = utp.user_id
           WHERE utp.team_id = $1 AND u.team_id <> $1`, [teamId]);
        for (const r of extra.rows) {
          if (byId.has(r.id)) continue;
          const { utpPermissions, utpGroupScope, utpIsTeamAdmin, ...base } = r;
          byId.set(r.id, {
            ...base,
            permissions: utpPermissions ?? "{}",
            groupScope: utpGroupScope ?? "",
            isTeamAdmin: utpIsTeamAdmin ?? 0,
            fromOtherTeam: true, homeTeamId: r.teamId,
          });
        }
      } catch (e) { console.error("[users] multi-team merge failed:", e); }
    }
    // Terms acceptance is owner-level compliance data — stripped for everyone
    // except the Super Admin so no TA surface can ever show it.
    const includeTerms = userInfo(req).isAdmin === true;
    res.json([...byId.values()].map(({ password, utpPermissions, utpGroupScope, utpIsTeamAdmin, termsAcceptedAt, termsAcceptedVersion, ...rest }: any) =>
      includeTerms ? { ...rest, termsAcceptedAt, termsAcceptedVersion } : rest
    ));
  });

  app.post("/api/users", requireAuth, async (req, res) => {
    const u = req.user!;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const existing = await storage.getUserByEmail(req.body.email);
    if (existing) return res.status(409).json({ message: "Email already in use" });
    const pwError = validatePassword(req.body.password);
    if (pwError) return res.status(400).json({ message: pwError });
    let sanitizedPerms = sanitizePermissions(req.body.permissions);
    const teamId = u.isAdmin === 1 ? (req.body.teamId || getActiveTeamId(req)) : u.teamId;
    const userLimit = await checkTeamLimit(teamId, "users");
    if (!userLimit.allowed) return res.status(403).json({ message: `Team has reached the user limit (${userLimit.limit}).` });
    const isSuperAdmin = u.isAdmin === 1;
    if (!isSuperAdmin) {
      sanitizedPerms = await enforceTeamAreas(sanitizedPerms, teamId);
    }
    const hashedPw = await hashPassword(req.body.password);
    // Derive username: use provided username, or fall back to email prefix
    let usernameToSet = req.body.username?.trim()?.toLowerCase() || null;
    if (!usernameToSet) {
      usernameToSet = req.body.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
    }
    // Ensure uniqueness by appending number if needed
    const { pool: pgUser } = await import("./db");
    let finalUsername = usernameToSet;
    let suffix = 2;
    while (true) {
      const existingUn = await (pgUser as any).query(`SELECT id FROM users WHERE LOWER(username) = $1`, [finalUsername]);
      if (existingUn.rows.length === 0) break;
      finalUsername = `${usernameToSet}${suffix++}`;
    }
    const isAthleteAccess = req.body.isAthleteAccess ? 1 : 0;
    const linkedAthleteId = req.body.linkedAthleteId ? parseInt(req.body.linkedAthleteId) : null;
    const created = await storage.createUser({
      email: req.body.email,
      password: hashedPw,
      name: req.body.name,
      username: finalUsername,
      groupScope: req.body.groupScope,
      isAdmin: isSuperAdmin && req.body.isAdmin ? 1 : 0,
      isTeamAdmin: req.body.isTeamAdmin ? 1 : 0,
      permissions: JSON.stringify(sanitizedPerms),
      teamId,
      isBlindTester: req.body.isBlindTester ? 1 : 0,
      isTester: req.body.isTester ? 1 : 0,
      isAthleteAccess,
      linkedAthleteId,
      language: req.body.language || "no",
      createdAt: new Date().toISOString(),
    } as any);
    const { password, ...safe } = created;
    res.json(safe);
    // Send welcome email (fire-and-forget) — only if explicitly requested (defaults to true)
    if (req.body.sendWelcomeEmail !== false) {
      sendWelcomeEmail(created.email, created.name, created.language ?? "no").catch((e) => console.error("[welcome-email]", e));
    }
  });

  app.put("/api/users/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1) {
      const targetUser = await storage.getUser(id);
      if (!targetUser || targetUser.teamId !== getActiveTeamId(req)) {
        return res.status(403).json({ message: "Can only manage users in your team" });
      }
    }
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.email !== undefined) data.email = req.body.email;
    if (req.body.username !== undefined && req.body.username.trim()) {
      const newUsername = req.body.username.trim().toLowerCase();
      const { pool: pgEdit } = await import("./db");
      const existing = await (pgEdit as any).query(`SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2`, [newUsername, id]);
      if (existing.rows.length > 0) return res.status(409).json({ message: "Username already taken" });
      data.username = newUsername;
    }
    if (req.body.groupScope !== undefined) data.groupScope = req.body.groupScope;
    if (req.body.phone !== undefined) data.phone = String(req.body.phone).trim().slice(0, 40) || null;
    if (u.isAdmin === 1 && req.body.isAdmin !== undefined) data.isAdmin = req.body.isAdmin ? 1 : 0;
    if (req.body.isTeamAdmin !== undefined) data.isTeamAdmin = req.body.isTeamAdmin ? 1 : 0;
    if (req.body.permissions !== undefined) {
      let perms = sanitizePermissions(req.body.permissions);
      if (u.isAdmin !== 1) {
        const targetTeamId = data.teamId || (await storage.getUser(id))?.teamId;
        perms = await enforceTeamAreas(perms, targetTeamId);
      }
      data.permissions = JSON.stringify(perms);
    }
    // Same rule as the per-team menu: making someone a Team Admin grants edit
    // across every area the team has, so the two menus never disagree.
    if (data.isTeamAdmin === 1) {
      const targetTeamId = data.teamId || (await storage.getUser(id))?.teamId;
      data.permissions = JSON.stringify(await teamAdminPermissions(targetTeamId));
    }
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive ? 1 : 0;
    if (u.isAdmin === 1 && req.body.teamId !== undefined) data.teamId = req.body.teamId;
    if (req.body.isBlindTester !== undefined) data.isBlindTester = req.body.isBlindTester ? 1 : 0;
    if (req.body.isTester !== undefined) data.isTester = req.body.isTester ? 1 : 0;
    if (req.body.isAthleteAccess !== undefined) data.isAthleteAccess = req.body.isAthleteAccess ? 1 : 0;
    if (req.body.linkedAthleteId !== undefined) data.linkedAthleteId = req.body.linkedAthleteId ? parseInt(req.body.linkedAthleteId) : null;
    const updated = await storage.updateUser(id, data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    const { password, ...safe } = updated;
    res.json(safe);
  });

  app.post("/api/users/:id/reset-password", requireAuth, async (req, res) => {
    const u = req.user!;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1) {
      const targetUser = await storage.getUser(id);
      if (!targetUser || targetUser.teamId !== getActiveTeamId(req)) {
        return res.status(403).json({ message: "Can only manage users in your team" });
      }
    }
    const newPassword = req.body.password;
    if (!newPassword) return res.status(400).json({ message: "Password is required" });
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ message: pwError });
    const hashedPw = await hashPassword(newPassword);
    const updated = await storage.updateUser(id, { password: hashedPw, failedAttempts: 0, loginLocked: 0 });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    if (id === u.id) return res.status(400).json({ message: "Cannot delete yourself" });
    if (u.isAdmin !== 1) {
      const targetUser = await storage.getUser(id);
      if (!targetUser || targetUser.teamId !== getActiveTeamId(req)) {
        return res.status(403).json({ message: "Can only manage users in your team" });
      }
    }
    const target = await storage.getUser(id);
    const deleted = await storage.deleteUser(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    // Full account cleanup — no trace of the ACCOUNT remains anywhere: logins,
    // devices, sessions, memberships, shares, personal inbox and pending
    // invitations/reset tokens all go. Data the user CREATED stays (their name
    // is denormalized onto it), and the team activity log is kept by design.
    try {
      const { pool: pDel } = await import("./db");
      await (pDel as any).query(`DELETE FROM login_logs WHERE user_id = $1`, [id]);
      await (pDel as any).query(`DELETE FROM user_teams WHERE user_id = $1`, [id]);
      await (pDel as any).query(`DELETE FROM user_team_permissions WHERE user_id = $1`, [id]);
      await (pDel as any).query(`DELETE FROM athlete_access WHERE user_id = $1`, [id]);
      await (pDel as any).query(`DELETE FROM inbox_messages WHERE to_user_id = $1`, [id]);
      await (pDel as any).query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [id]).catch(() => {});
      await (pDel as any).query(`DELETE FROM invitations WHERE email = $1`, [target?.email ?? ""]).catch(() => {});
      // Kill any live sessions so the account is signed out everywhere instantly.
      await (pDel as any).query(`DELETE FROM user_sessions WHERE sess->'passport'->>'user' = $1`, [String(id)]).catch(() => {});
    } catch (e) { console.error("[user-delete] cleanup failed:", e); }
    if (target) {
      const { password, totpSecret, totpBackupCodes, ...safe } = target as any;
      await recordDeletion(req, "user", id, `User deleted: ${target.name} (${target.email})`, safe);
    }
    res.json({ ok: true });
  });

  // Unlock a locked account (Team Admin or SA)
  app.post("/api/users/:id/unlock", requireAuth, async (req, res) => {
    const u = req.user!;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1) {
      const targetUser = await storage.getUser(id);
      if (!targetUser || targetUser.teamId !== getActiveTeamId(req)) {
        return res.status(403).json({ message: "Can only manage users in your team" });
      }
    }
    const { pool: pg } = await import("./db");
    await (pg as any).query(
      "UPDATE users SET failed_attempts = 0, login_locked = 0 WHERE id = $1",
      [id]
    );
    res.json({ ok: true });
  });

  // --- Garmin Watch access per-user ---
  app.put("/api/users/:id/garmin-watch", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const targetUser = await storage.getUser(id);
    if (!targetUser) return res.status(404).json({ message: "User not found" });
    const u = req.user!;
    if (u.isAdmin !== 1 && targetUser.teamId !== getActiveTeamId(req)) {
      return res.status(403).json({ message: "Cannot modify users outside your team" });
    }
    const { pool: p } = await import("./db");
    const enabled = !!req.body.enabled;
    await (p as any).query("UPDATE users SET garmin_watch = $1 WHERE id = $2", [enabled ? 1 : 0, id]);
    res.json({ ok: true, garminWatch: enabled });
  });

  // --- "All teams" glide-view access per-user (granted by a Team Admin) ---
  app.put("/api/users/:id/all-teams-access", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const targetUser = await storage.getUser(id);
    if (!targetUser) return res.status(404).json({ message: "User not found" });
    // Team boundary: a TA may only grant/revoke All-teams for users of their
    // ACTIVE team (SA unrestricted).
    if ((req.user as any).isAdmin !== 1 && targetUser.teamId !== getActiveTeamId(req)) {
      return res.status(403).json({ message: "Can only manage users in your team" });
    }
    const { pool: p } = await import("./db");
    const enabled = !!req.body.enabled;
    await (p as any).query("UPDATE users SET can_view_all_teams = $1 WHERE id = $2", [enabled ? 1 : 0, id]);
    res.json({ ok: true, canViewAllTeams: enabled });
  });

  // --- Per-team permissions for multi-team users ---
  app.get("/api/users/:id/team-permissions", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const u = req.user!;
    const { pool: p } = await import("./db");
    const result = await (p as any).query(
      "SELECT team_id, permissions, group_scope, is_team_admin FROM user_team_permissions WHERE user_id = $1",
      [userId]
    );
    // A TA only sees the override for the team they administer — other teams'
    // configuration of the same user is not their business.
    const rows = u.isAdmin === 1
      ? result.rows
      : result.rows.filter((r: any) => r.team_id === getActiveTeamId(req));
    const out = rows.map((r: any) => ({ ...r, isTeamAdmin: r.is_team_admin === 1 || r.is_team_admin === true }));

    // The user's own team is stored on the user row, not here. Report it in the
    // same shape so every menu reads one answer per team instead of showing
    // "using global settings" for a team that in fact has concrete settings.
    const target = await storage.getUser(userId);
    if (target && (u.isAdmin === 1 || target.teamId === getActiveTeamId(req))) {
      out.push({
        team_id: target.teamId,
        permissions: target.permissions,
        group_scope: target.groupScope ?? "",
        is_team_admin: target.isTeamAdmin,
        isTeamAdmin: target.isTeamAdmin === 1 || (target.isTeamAdmin as unknown) === true,
        isHomeTeam: true,
      });
    }
    res.json(out);
  });

  app.put("/api/users/:id/team-permissions/:teamId", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const teamId = parseInt(req.params.teamId);
    const u = req.user!;
    const { pool: p } = await import("./db");
    // Super Admins are never shared into teams — they access everything by role.
    const targetShared = await storage.getUser(userId);
    if ((targetShared as any)?.isAdmin === 1) {
      return res.status(400).json({ message: "Super Admins already have access to every team" });
    }
    // The RECEIVING team's admin is the first line for shared users: a TA may
    // set per-team permissions for the team they currently administer — and
    // only for users already shared into (or belonging to) that team.
    if (u.isAdmin !== 1) {
      if (teamId !== getActiveTeamId(req)) return res.status(403).json({ message: "Cannot manage permissions for other teams" });
      const member = await (p as any).query(
        `SELECT 1 FROM user_teams WHERE user_id = $1 AND team_id = $2
         UNION SELECT 1 FROM user_team_permissions WHERE user_id = $1 AND team_id = $2
         UNION SELECT 1 FROM users WHERE id = $1 AND team_id = $2 LIMIT 1`,
        [userId, teamId]
      );
      if (member.rows.length === 0) return res.status(403).json({ message: "User is not shared with this team" });
    }
    const isTeamAdmin = req.body.isTeamAdmin ? 1 : 0;
    let perms = isTeamAdmin
      ? await teamAdminPermissions(teamId)
      : sanitizePermissions(req.body.permissions);
    if (u.isAdmin !== 1 && !isTeamAdmin) {
      perms = await enforceTeamAreas(perms, teamId);
    }
    const groupScope = req.body.groupScope !== undefined ? String(req.body.groupScope) : "";

    // One record per (user, team): a user's OWN team lives on the user row, every
    // other team in user_team_permissions. Writing an override for the user's own
    // team would leave two menus editing two different records for the same team
    // and disagreeing about the answer.
    if (targetShared && targetShared.teamId === teamId) {
      await storage.updateUser(userId, {
        permissions: JSON.stringify(perms),
        groupScope,
        isTeamAdmin,
      } as any);
      await (p as any).query(`DELETE FROM user_team_permissions WHERE user_id = $1 AND team_id = $2`, [userId, teamId]);
      return res.json({ ok: true });
    }

    await (p as any).query(
      `INSERT INTO user_team_permissions (user_id, team_id, permissions, group_scope, is_team_admin)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ON CONSTRAINT utp_user_team_unique DO UPDATE SET permissions = $3, group_scope = $4, is_team_admin = $5`,
      [userId, teamId, JSON.stringify(perms), groupScope, isTeamAdmin]
    );
    res.json({ ok: true });
  });

  app.delete("/api/users/:id/team-permissions/:teamId", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const teamId = parseInt(req.params.teamId);
    const u = req.user!;
    if (u.isAdmin !== 1 && teamId !== getActiveTeamId(req)) {
      return res.status(403).json({ message: "Cannot manage permissions for other teams" });
    }
    // Their own team IS the baseline — there is nothing to fall back to.
    const target = await storage.getUser(userId);
    if (target && target.teamId === teamId) {
      return res.status(400).json({ message: "This is the user's own team — edit the settings instead of resetting them" });
    }
    const { pool: p } = await import("./db");
    await (p as any).query(
      "DELETE FROM user_team_permissions WHERE user_id = $1 AND team_id = $2",
      [userId, teamId]
    );
    res.json({ ok: true });
  });

  // Add an EXISTING user (by email) to a team with a member/team-admin role.
  // Used by the "Add existing user" button on the Users page. The user gains
  // access to this team in addition to their home team; revoke via the normal
  // remove-from-team action.
  app.post("/api/teams/:teamId/add-member", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const u = req.user!;
    const teamId = parseInt(req.params.teamId);
    // A Team Admin may only add members to the team they administer.
    if (u.isAdmin !== 1 && teamId !== getActiveTeamId(req)) {
      return res.status(403).json({ message: "Cannot add members to another team" });
    }
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const role = req.body.role === "teamAdmin" ? "teamAdmin" : "member";
    if (!email) return res.status(400).json({ message: "Email required" });
    const target = await storage.getUserByEmail(email);
    if (!target) return res.status(404).json({ message: "User does not exist" });
    if (target.teamId === teamId) return res.status(400).json({ message: "User is already on this team" });
    if ((target as any).isAdmin === 1) return res.status(400).json({ message: "Super Admins already have access to every team" });

    // Membership (so they can switch to the team) + per-team role/permissions
    // (so they appear in the Users list with the right role).
    await storage.addUserToTeam(target.id, teamId);
    const isTeamAdmin = role === "teamAdmin" ? 1 : 0;
    let perms: Record<string, string> = Object.fromEntries(PERMISSION_AREAS.map((a) => [a, "edit"]));
    if (!isTeamAdmin) perms = await enforceTeamAreas(perms, teamId); // members limited to the team's enabled areas
    const { pool } = await import("./db");
    await (pool as any).query(
      `INSERT INTO user_team_permissions (user_id, team_id, permissions, group_scope, is_team_admin)
       VALUES ($1, $2, $3, '', $4)
       ON CONFLICT ON CONSTRAINT utp_user_team_unique DO UPDATE SET permissions = $3, is_team_admin = $4`,
      [target.id, teamId, JSON.stringify(perms), isTeamAdmin]
    );
    res.json({ ok: true, userId: target.id, name: target.name, role });
  });

  app.get("/api/login-logs", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getAdminTeamScope(req);
    const logs = await storage.listLoginLogs(teamId);
    // #25: login history shows ONLY actual logins; in-app actions belong in the activity log.
    res.json(logs.filter((l: any) => (l.action ?? "login") === "login"));
  });

  // SA only: remove login-history rows (single row, or a whole team's history).
  // The deletion itself is recorded in the activity log so SA keeps a trace.
  app.delete("/api/login-logs/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    // login_logs has no team column — resolve the row's team via its user.
    const r = await (pool as any).query(`DELETE FROM login_logs WHERE id = $1 RETURNING name, user_id`, [id]);
    if (!r.rows.length) return res.status(404).json({ message: "Not found" });
    const owner = await storage.getUser(r.rows[0].user_id).catch(() => null);
    await storage.createActivityLog({
      userId: u.id, userName: u.name, action: "login_log_deleted",
      entityType: "login_log", entityId: id,
      details: `Login-history row removed (${r.rows[0].name ?? id})`,
      createdAt: new Date().toISOString(), groupScope: "", teamId: owner?.teamId ?? (u as any).activeTeamId ?? u.teamId,
    } as any).catch(() => {});
    res.json({ ok: true });
  });

  app.delete("/api/login-logs", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const teamId = parseInt(String(req.query.teamId ?? ""));
    if (!teamId) return res.status(400).json({ message: "teamId required" });
    const { pool } = await import("./db");
    // login_logs has no team column — scope via the team's users.
    const r = await (pool as any).query(
      `DELETE FROM login_logs WHERE user_id IN (SELECT id FROM users WHERE team_id = $1)`, [teamId]);
    await storage.createActivityLog({
      userId: u.id, userName: u.name, action: "login_log_deleted",
      entityType: "login_log", entityId: teamId,
      details: `Login history cleared for team ${teamId} (${r.rowCount} rows)`,
      createdAt: new Date().toISOString(), groupScope: "", teamId,
    } as any).catch(() => {});
    res.json({ ok: true, deleted: r.rowCount });
  });

  app.post("/api/action-log", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const { action, details } = req.body;
    if (!action) return res.status(400).json({ message: "action required" });
    const ip = req.headers["x-forwarded-for"]
      ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
      : req.socket.remoteAddress || "unknown";
    if (!isIncognito(req)) {
      await storage.createLoginLog({
        userId: u.id,
        email: u.email,
        name: u.name,
        loginAt: new Date().toISOString(),
        ipAddress: ip,
        action,
        details: details || null,
      });
    }
    res.json({ ok: true });
  });

  app.get("/api/stock-changes", requirePermission("products", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const limit = parseInt(req.query.limit as string) || 500;
    const logs = await storage.listStockChanges(limit, teamId);
    res.json(logs);
  });

  // Activity feed
  app.get("/api/activity", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    // #23: show far more history, and allow filtering by action.
    const limit = Math.min(parseInt(req.query.limit as string) || 2000, 10000);
    const actionFilter = (req.query.action as string) || "";
    const teamId = getAdminTeamScope(req);
    let logs = await storage.listActivityLogs(limit, teamId);
    // Terms-acceptance records are owner-level compliance data — SA only.
    if (userInfo(req).isAdmin !== true) logs = logs.filter((l: any) => l.action !== "accepted_terms" && l.action !== "terms_reset" && l.action !== "login_log_deleted");
    if (actionFilter) logs = logs.filter((l: any) => l.action === actionFilter);
    res.json(logs);
  });

  // Distinct actions present in the activity log (for the filter dropdown).
  app.get("/api/activity/actions", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getAdminTeamScope(req);
    let logs = await storage.listActivityLogs(10000, teamId);
    if (userInfo(req).isAdmin !== true) logs = logs.filter((l: any) => l.action !== "accepted_terms" && l.action !== "terms_reset" && l.action !== "login_log_deleted");
    const actions = [...new Set(logs.map((l: any) => l.action).filter(Boolean))].sort();
    res.json(actions);
  });

  // ── Terms acceptance overview (SA only) ─────────────────────────────────────
  // Who has accepted which version of the Terms & Policy — and the ability to
  // reset one user's acceptance so the gate reappears for them.
  app.get("/api/admin/terms-acceptances", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT u.id, u.name, u.email, u.team_id AS "teamId", t.name AS "teamName",
              u.is_active AS "isActive",
              u.terms_accepted_at AS "termsAcceptedAt",
              u.terms_accepted_version AS "termsAcceptedVersion"
       FROM users u LEFT JOIN teams t ON t.id = u.team_id
       ORDER BY u.terms_accepted_at NULLS FIRST, u.name ASC`
    );
    res.json({ currentVersion: CURRENT_TERMS_VERSION, users: r.rows });
  });

  app.delete("/api/admin/terms-acceptances/:userId", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const id = parseInt(req.params.userId);
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ message: "User not found" });
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE users SET terms_accepted_at = NULL, terms_accepted_version = NULL WHERE id = $1`, [id]
    );
    // Audited (SA-only visibility, like accepted_terms itself).
    await storage.createActivityLog({
      userId: u.id, userName: u.name, action: "terms_reset",
      entityType: "user", entityId: id,
      details: `Reset terms acceptance for ${target.name} (${target.email})`,
      createdAt: new Date().toISOString(), groupScope: u.groupScope, teamId: target.teamId,
    } as any).catch(() => {});
    res.json({ ok: true });
  });

  // Recover a deleted record from its audit snapshot (the "recycle bin").
  app.post("/api/audit/:id/restore", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const u = userInfo(req);
    const logId = parseInt(req.params.id);
    const { pool } = await import("./db");
    const r = await (pool as any).query(`SELECT * FROM activity_logs WHERE id = $1`, [logId]);
    const log = r.rows[0];
    if (!log) return res.status(404).json({ message: "Log entry not found" });
    if (log.action !== "deleted" || !log.snapshot) return res.status(400).json({ message: "Nothing to restore for this entry" });
    if (u.isAdmin !== 1 && log.team_id !== getActiveTeamId(req)) return res.status(403).json({ message: "Cannot restore from another team" });
    let snap: any;
    try { snap = JSON.parse(log.snapshot); } catch { return res.status(400).json({ message: "Snapshot is corrupt" }); }
    const strip = (o: any) => { if (!o) return o; const { id, ...rest } = o; return rest; };
    // Deleted test entries were snapshotted as raw (snake_case) rows.
    const mapEntry = (e: any, testId: number) => ({
      testId, skiNumber: e.ski_number, productId: e.product_id ?? null,
      additionalProductIds: e.additional_product_ids ?? null, freeTextProduct: e.free_text_product ?? null,
      methodology: e.methodology ?? "", result0kmCmBehind: e.result_0km_cm_behind ?? null, rank0km: e.rank_0km ?? null,
      resultXkmCmBehind: e.result_xkm_cm_behind ?? null, rankXkm: e.rank_xkm ?? null, results: e.results ?? null,
      feelingRank: e.feeling_rank ?? null, feelingNote: e.feeling_note ?? null, kickRank: e.kick_rank ?? null,
      kickSolution: e.kick_solution ?? null, grindType: e.grind_type ?? null, grindStone: e.grind_stone ?? null,
      grindPattern: e.grind_pattern ?? null, grindExtraParams: e.grind_extra_params ?? null, grindProfileId: e.grind_profile_id ?? null,
      raceSkiId: e.race_ski_id ?? null, createdAt: e.created_at ?? new Date().toISOString(),
      createdById: e.created_by_id ?? u.id, createdByName: e.created_by_name ?? u.name,
      groupScope: e.group_scope ?? "", teamId: e.team_id ?? getActiveTeamId(req),
    });
    // Generic restore for snapshots stored as raw (snake_case) DB rows: rebuild
    // the INSERT from the snapshot's own columns, minus id, plus FK overrides.
    const rawRestore = async (table: string, row: any, overrides: Record<string, any> = {}): Promise<number | null> => {
      if (!row) return null;
      const data: Record<string, any> = { ...row, ...overrides };
      delete data.id;
      const cols = Object.keys(data).filter((c) => /^[a-z0-9_]+$/i.test(c));
      const r2 = await (pool as any).query(
        `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
        cols.map((c) => data[c])
      );
      return r2.rows[0]?.id ?? null;
    };

    let restoredId: number | null = null;
    try {
      switch (log.entity_type) {
        case "product": restoredId = (await storage.createProduct(strip(snap) as any)).id; break;
        case "weather": restoredId = (await storage.createWeather(strip(snap) as any)).id; break;
        case "race_ski": restoredId = (await storage.createRaceSki(strip(snap) as any)).id; break;
        case "athlete": {
          const a = await storage.createAthlete(strip(snap.athlete ?? snap) as any);
          for (const ski of (snap.skis ?? [])) { try { await storage.createRaceSki({ ...strip(ski), athleteId: a.id } as any); } catch {} }
          restoredId = a.id; break;
        }
        case "test": {
          const t = await storage.createTest(strip(snap.test ?? snap) as any);
          for (const e of (snap.entries ?? [])) { try { await storage.createEntry(mapEntry(e, t.id) as any); } catch {} }
          restoredId = t.id; break;
        }
        case "group": restoredId = await rawRestore("groups", snap); break;
        case "kick_mix": restoredId = await rawRestore("kick_mixes", snap); break;
        case "kick_test": {
          const nid = await rawRestore("kick_tests", snap.test ?? snap);
          if (nid != null) for (const e of (snap.entries ?? [])) { try { await rawRestore("kick_test_entries", e, { kick_test_id: nid }); } catch {} }
          restoredId = nid; break;
        }
        case "race_prep": {
          const nid = await rawRestore("race_preps", snap.prep ?? snap);
          if (nid != null) for (const e of (snap.entries ?? [])) { try { await rawRestore("race_prep_entries", e, { race_prep_id: nid }); } catch {} }
          restoredId = nid; break;
        }
        case "race_prep_entry": restoredId = await rawRestore("race_prep_entries", snap); break;
        case "race_fleet_ski": {
          const nid = await rawRestore("race_skis", snap.ski ?? snap);
          if (nid != null) for (const rg of (snap.regrinds ?? [])) { try { await rawRestore("race_ski_regrinds", rg, { race_ski_id: nid }); } catch {} }
          restoredId = nid; break;
        }
        default: return res.status(400).json({ message: `Restore not supported for ${log.entity_type}` });
      }
    } catch (e: any) {
      console.error("[audit] restore failed:", e);
      return res.status(500).json({ message: "Restore failed: " + (e?.message || "unknown") });
    }
    // Mark the log so it isn't restored twice, and record the restore action.
    await (pool as any).query(`UPDATE activity_logs SET action = 'restored' WHERE id = $1`, [logId]).catch(() => {});
    await storage.createActivityLog({
      userId: u.id, userName: u.name, action: "restored",
      entityType: log.entity_type, entityId: restoredId ?? 0,
      details: `Restored ${log.entity_type}${restoredId ? ` (#${restoredId})` : ""}`,
      createdAt: new Date().toISOString(), groupScope: u.groupScope, teamId: getActiveTeamId(req),
    } as any).catch(() => {});
    res.json({ ok: true, id: restoredId, entityType: log.entity_type });
  });

  // Quota / usage overview for a team (current count vs. limit per resource).
  app.get("/api/team-usage", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getAdminTeamScope(req) ?? getActiveTeamId(req);
    if (!teamId) return res.status(400).json({ message: "Select a specific team" });
    const { pool } = await import("./db");
    const tRes = await (pool as any).query(`SELECT name, max_users, max_groups, max_tests, max_products FROM teams WHERE id = $1`, [teamId]);
    const t = tRes.rows[0] || {};
    const count = async (table: string) => parseInt((await (pool as any).query(`SELECT COUNT(*) AS c FROM ${table} WHERE team_id = $1`, [teamId])).rows[0]?.c || "0");
    const [users, groups, tests, products] = await Promise.all([count("users"), count("groups"), count("tests"), count("products")]);
    res.json({
      teamId, teamName: t.name ?? null,
      users:    { current: users,    limit: t.max_users ?? null },
      groups:   { current: groups,   limit: t.max_groups ?? null },
      tests:    { current: tests,    limit: t.max_tests ?? null },
      products: { current: products, limit: t.max_products ?? null },
    });
  });

  // Profile - change own password
  app.post("/api/users/me/password", requireAuth, async (req, res) => {
    const u = req.user!;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Both current and new password required" });
    const { verifyPassword, hashPassword: hp } = await import("./auth");
    const valid = await verifyPassword(currentPassword, u.password);
    if (!valid) return res.status(403).json({ message: "Current password is incorrect" });
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ message: pwError });
    const hashed = await hp(newPassword);
    await storage.updateUser(u.id, { password: hashed });
    res.json({ ok: true });
  });

  // Change own username
  app.put("/api/users/me/username", requireAuth, async (req, res) => {
    const u = req.user!;
    const { username } = req.body;
    if (!username || typeof username !== "string" || username.trim().length < 2) {
      return res.status(400).json({ message: "Username must be at least 2 characters" });
    }
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(clean)) {
      return res.status(400).json({ message: "Username may only contain letters, numbers, dots, underscores and dashes" });
    }
    const { pool } = await import("./db");
    // Check uniqueness
    const existing = await (pool as any).query(
      `SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2`,
      [clean, u.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Username already taken" });
    }
    await storage.updateUser(u.id, { username: clean } as any);
    // Update session
    (u as any).username = clean;
    return res.json({ ok: true, username: clean });
  });

  // GDPR data export
  app.get("/api/users/me/data-export", requireAuth, async (req, res) => {
    const u = req.user!;
    try {
      const { pool } = await import("./db");
      const userRow = await (pool as any).query(`SELECT id, email, name, username, created_at FROM users WHERE id = $1`, [u.id]);
      const testsRows = await (pool as any).query(`SELECT * FROM tests WHERE created_by_id = $1 ORDER BY date DESC`, [u.id]);
      const entriesRows = await (pool as any).query(`SELECT * FROM test_entries WHERE test_id = ANY(SELECT id FROM tests WHERE created_by_id = $1)`, [u.id]);
      const data = {
        exportedAt: new Date().toISOString(),
        user: userRow.rows[0] ?? null,
        tests: testsRows.rows,
        testEntries: entriesRows.rows,
      };
      res.setHeader("Content-Disposition", 'attachment; filename="glidr-my-data.json"');
      res.setHeader("Content-Type", "application/json");
      return res.send(JSON.stringify(data, null, 2));
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Update own profile preferences (dateFormat, etc.)
  app.put("/api/user/profile", requireAuth, async (req, res) => {
    const u = req.user!;
    const { dateFormat } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (dateFormat !== undefined) {
      if (dateFormat !== 'european' && dateFormat !== 'american') {
        return res.status(400).json({ message: "dateFormat must be 'european' or 'american'" });
      }
      updates.push(`date_format = $${values.length + 1}`);
      values.push(dateFormat);
    }
    const { tempUnit } = req.body;
    if (tempUnit !== undefined) {
      if (tempUnit !== 'C' && tempUnit !== 'F') {
        return res.status(400).json({ message: "tempUnit must be 'C' or 'F'" });
      }
      updates.push(`temp_unit = $${values.length + 1}`);
      values.push(tempUnit);
    }
    // Contact details are the member's own to maintain; the whole team sees them.
    const { phone } = req.body;
    if (phone !== undefined) {
      const clean = String(phone).trim().slice(0, 40);
      updates.push(`phone = $${values.length + 1}`);
      values.push(clean || null);
    }
    if (updates.length === 0) return res.status(400).json({ message: "No fields to update" });
    values.push(u.id);
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length}`,
      values
    );
    return res.json({ ok: true });
  });

  // Update own avatar
  app.put("/api/auth/me/avatar", requireAuth, async (req, res) => {
    const u = req.user as any;
    const { avatarUrl } = req.body;
    if (typeof avatarUrl !== "string" && avatarUrl !== null) {
      return res.status(400).json({ message: "avatarUrl must be a string or null" });
    }
    // If it's a data URL, enforce 200KB limit
    if (typeof avatarUrl === "string" && avatarUrl.startsWith("data:")) {
      const base64 = avatarUrl.split(",")[1] ?? "";
      const sizeBytes = Math.ceil((base64.length * 3) / 4);
      if (sizeBytes > 200 * 1024) {
        return res.status(400).json({ message: "Image must be smaller than 200 KB" });
      }
    }
    await storage.updateUser(u.id, { avatarUrl } as any);
    (u as any).avatarUrl = avatarUrl;
    return res.json({ ok: true, avatarUrl });
  });

  // PATCH /api/team/settings — a Team Admin adjusts their own team's timezone.
  // (Currency and VAT status are commercial terms — SA only, via PUT /api/teams/:id.)
  app.patch("/api/team/settings", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getActiveTeamId(req);
    if (!teamId) return res.status(400).json({ message: "No active team" });
    const data: any = {};
    if (req.body.timezone !== undefined) {
      const tz = String(req.body.timezone);
      try { new Date().toLocaleString("sv-SE", { timeZone: tz }); }
      catch { return res.status(400).json({ message: "Unknown timezone" }); }
      data.timezone = tz;
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ message: "No fields to update" });
    const updated = await storage.updateTeam(teamId, data);
    res.json({ ok: true, timezone: (updated as any)?.timezone });
  });

  // PATCH /api/team/plan — a Team Admin adjusts THEIR OWN team's plan
  // composition (features + limits). Only while commercialization is ON and
  // only for teams on the dynamic "custom" plan — fixed plans go through SA.
  // The invoice sum follows automatically since custom plans are priced live.
  app.patch("/api/team/plan", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team admin only" });
    const u = req.user as any;
    const teamId = getActiveTeamId(req);
    try {
      const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'commercialization_enabled'`);
      const row = ((rows as any).rows ?? rows)[0];
      if (row?.value === "false") return res.status(403).json({ message: "Plan self-service is not available" });
    } catch { /* default open */ }
    const team = await storage.getTeam(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });
    if ((team.planName ?? "free") !== "custom") {
      return res.status(400).json({ message: "This team is on a fixed plan — contact Glidr to change it" });
    }
    const { sanitizeFeatureSelection, clampLimit, computeCustomPrice } = await import("@shared/pricing");
    const features = sanitizeFeatureSelection(req.body.features);
    const maxUsers = req.body.maxUsers !== undefined ? clampLimit("users", Number(req.body.maxUsers)) : (team.maxUsers ?? null);
    const maxGroups = req.body.maxGroups !== undefined ? clampLimit("groups", Number(req.body.maxGroups)) : (team.maxGroups ?? null);
    const { pool: pPlan } = await import("./db");
    await (pPlan as any).query(
      `UPDATE teams SET enabled_areas = $1, max_users = $2, max_groups = $3 WHERE id = $4`,
      [JSON.stringify(features), maxUsers, maxGroups, teamId]
    );
    // Traceability: plan change log + team activity + SA inbox heads-up with the new price.
    let overrides: any = null;
    try {
      const or = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'plan_builder_pricing'`);
      const orow = ((or as any).rows ?? or)[0];
      if (orow?.value) overrides = JSON.parse(orow.value);
    } catch { /* defaults */ }
    const priced = computeCustomPrice({ features, maxUsers: maxUsers ?? 1, maxGroups: maxGroups ?? 1, billingPeriod: (team.billingPeriod as any) === "annual" ? "annual" : "monthly" }, overrides);
    const now = new Date().toISOString();
    await (pPlan as any).query(
      `INSERT INTO plan_change_log (team_id, team_name, changed_at, changed_by, old_plan, new_plan, old_price, new_price, billing_period, notes)
       VALUES ($1,$2,$3,$4,'custom','custom',$5,$6,$7,$8)`,
      [teamId, team.name, now, u.name || u.email || null, team.customPrice ?? null, priced.monthlyTotal, team.billingPeriod ?? "monthly", "Changed by Team Admin (self-service)"]
    ).catch(() => {});
    await storage.createActivityLog({
      userId: u.id, userName: u.name, action: "plan_changed",
      entityType: "team", entityId: teamId,
      details: `Team plan adjusted by TA — new monthly price ${priced.monthlyTotal} NOK`,
      createdAt: now, groupScope: "", teamId,
    } as any).catch(() => {});
    try {
      const saUsers = await db.execute(sql`SELECT id FROM users WHERE is_admin = 1`);
      for (const sa of ((saUsers as any).rows ?? saUsers)) {
        await db.execute(sql`
          INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at)
          VALUES (${sa.id}, 'Glidr System', ${"Planendring: " + team.name},
            ${`${u.name} (TA) endret planen for «${team.name}». Ny månedspris: ${priced.monthlyTotal} NOK. Brukere: ${maxUsers ?? "-"}, grupper: ${maxGroups ?? "-"}. Se Admin → Accounting.`},
            0, ${now})
        `);
      }
    } catch { /* best-effort */ }
    res.json({ ok: true, monthlyTotal: priced.monthlyTotal });
  });

  // GET /api/team/members — members of the caller's active team
  // Header card on My Team. Identity (name, logo, nation, timezone) is for
  // everyone — the timezone in particular decides what every logged time means.
  // Seats and subscription are management data: Team Admins only, and only
  // while the SA has commercialization switched on.
  app.get("/api/team/profile", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    if (!teamId) return res.status(400).json({ message: "No active team" });
    try {
      const { pool: pgT } = await import("./db");
      const r = await (pgT as any).query(
        `SELECT id, name, team_logo, nation, timezone, max_users, plan_name,
                subscription_status, current_period_end, trial_ends_at
         FROM teams WHERE id = $1`, [teamId]);
      const t = r.rows[0];
      if (!t) return res.status(404).json({ message: "Team not found" });

      const cnt = await (pgT as any).query(
        `SELECT COUNT(DISTINCT id)::int AS n FROM (
           SELECT id FROM users WHERE team_id = $1 AND is_active = 1 AND is_admin <> 1
           UNION
           SELECT u.id FROM users u WHERE u.is_active = 1 AND u.is_admin <> 1 AND u.team_id <> $1 AND (
             u.id IN (SELECT user_id FROM user_teams WHERE team_id = $1)
             OR u.id IN (SELECT user_id FROM user_team_permissions WHERE team_id = $1))
         ) x`, [teamId]);

      let commercial = true;
      try {
        const cRes = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'commercialization_enabled'`);
        commercial = ((cRes as any).rows?.[0]?.value) !== 'false';
      } catch {}

      const out: any = {
        id: t.id, name: t.name, teamLogo: t.team_logo ?? null,
        nation: t.nation ?? null, timezone: t.timezone ?? "Europe/Oslo",
        memberCount: cnt.rows[0]?.n ?? 0,
      };
      if (canManageTeam(req) && commercial) {
        out.billing = {
          maxUsers: t.max_users ?? null,
          planName: t.plan_name ?? null,
          subscriptionStatus: t.subscription_status ?? null,
          currentPeriodEnd: t.current_period_end ?? null,
          trialEndsAt: t.trial_ends_at ?? null,
        };
      }
      return res.json(out);
    } catch (err) {
      console.error("Failed to fetch team profile:", err);
      return res.status(500).json({ message: "Failed to fetch team profile" });
    }
  });

  // Inline member management from My Team. Deliberately narrow: groups, phone
  // and the admin flag — nothing else. For a member shared in from another team
  // only their groups IN THIS TEAM are ours to change; their account, role and
  // contact details belong to their own team.
  app.put("/api/team/members/:id/access", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getActiveTeamId(req);
    if (!teamId) return res.status(400).json({ message: "No active team" });
    const id = parseInt(req.params.id);
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ message: "Not found" });
    if ((target as any).isAdmin === 1) return res.status(400).json({ message: "Super Admins are not team members" });

    const { pool: pgM } = await import("./db");
    const external = target.teamId !== teamId;
    if (external) {
      const member = await (pgM as any).query(
        `SELECT 1 FROM user_teams WHERE user_id = $1 AND team_id = $2
         UNION SELECT 1 FROM user_team_permissions WHERE user_id = $1 AND team_id = $2 LIMIT 1`,
        [id, teamId]);
      if (member.rows.length === 0) return res.status(403).json({ message: "User is not shared with this team" });
      if (req.body.groupScope !== undefined) {
        // Update the scope in place; never touch the stored permissions.
        const upd = await (pgM as any).query(
          `UPDATE user_team_permissions SET group_scope = $1 WHERE user_id = $2 AND team_id = $3`,
          [String(req.body.groupScope), id, teamId]);
        if (upd.rowCount === 0) {
          await (pgM as any).query(
            `INSERT INTO user_team_permissions (user_id, team_id, permissions, group_scope, is_team_admin)
             VALUES ($1, $2, $3, $4, 0)
             ON CONFLICT ON CONSTRAINT utp_user_team_unique DO UPDATE SET group_scope = $4`,
            [id, teamId, JSON.stringify(sanitizePermissions((target as any).permissions ? JSON.parse((target as any).permissions) : undefined)), String(req.body.groupScope)]);
        }
      }
      return res.json({ ok: true });
    }

    const data: any = {};
    if (req.body.groupScope !== undefined) data.groupScope = String(req.body.groupScope);
    if (req.body.phone !== undefined) data.phone = String(req.body.phone).trim().slice(0, 40) || null;
    if (req.body.isTeamAdmin !== undefined && id !== req.user!.id) {
      data.isTeamAdmin = req.body.isTeamAdmin ? 1 : 0;
      // Granting team admin grants edit everywhere the team has — same rule as
      // the Admin menus, so a user's rights read the same wherever you look.
      if (data.isTeamAdmin === 1) data.permissions = JSON.stringify(await teamAdminPermissions(teamId));
    }
    // "Remove from team" deactivates rather than deletes — reversible from Admin.
    if (req.body.isActive !== undefined && id !== req.user!.id) data.isActive = req.body.isActive ? 1 : 0;
    if (Object.keys(data).length === 0) return res.json({ ok: true });
    await storage.updateUser(id, data);
    return res.json({ ok: true });
  });

  app.get("/api/team/members", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    if (!teamId) return res.status(400).json({ message: "No active team" });
    try {
      // Active users with the team as PRIMARY team, plus users SHARED into the
      // team (user_teams / user_team_permissions) — a shared-in waxer is just
      // as much a member of this team's daily work as a primary member.
      const rows = await storage.listUsers(teamId);
      try {
        const { pool } = await import("./db");
        const shared = await (pool as any).query(
          `SELECT DISTINCT u.* FROM users u
           WHERE u.team_id <> $1 AND (
             u.id IN (SELECT user_id FROM user_teams WHERE team_id = $1)
             OR u.id IN (SELECT user_id FROM user_team_permissions WHERE team_id = $1)
           )`, [teamId]);
        const have = new Set(rows.map((r: any) => r.id));
        for (const r of shared.rows) {
          if (have.has(r.id)) continue;
          rows.push({
            ...r,
            isActive: r.is_active, isAdmin: r.is_admin, isTeamAdmin: r.is_team_admin,
            groupScope: r.group_scope, avatarUrl: r.avatar_url, createdAt: r.created_at,
            phone: r.phone, lastSeen: r.last_seen,
          } as any);
        }
      } catch (e) { console.error("[team/members] shared merge failed:", e); }

      const visible = rows
        .filter((u) => u.isActive === 1 || u.isActive === true)
        // Super Admins are not team members — never listed on My Team.
        .filter((u) => u.isAdmin !== 1);
      const ids = visible.map((u: any) => u.id);

      // Work contribution is team-visible: "who ran the glide tests in Davos?"
      // is an ordinary question between colleagues, and the answer already sits
      // on every test. Login times are NOT — those are attendance, and only the
      // Team Admin, who carries the personnel responsibility, sees them.
      const { pool: pgAct } = await import("./db");
      const counts = new Map<number, { tests: number; lastTest: string | null }>();
      const homeTeams = new Map<number, string>();
      const extScopes = new Map<number, string>();
      if (ids.length) {
        try {
          const r = await (pgAct as any).query(
            `SELECT created_by_id AS id, COUNT(*)::int AS n, MAX(date) AS last
             FROM tests WHERE team_id = $1 AND created_by_id = ANY($2::int[]) GROUP BY created_by_id`,
            [teamId, ids]);
          for (const row of r.rows) counts.set(row.id, { tests: row.n, lastTest: row.last ?? null });
        } catch (e) { console.error("[team/members] test counts failed:", e); }
        try {
          // Members shared in from elsewhere are labelled by the team they come
          // from — "Admin"/"Member" would say nothing about who they are here.
          const r = await (pgAct as any).query(
            `SELECT u.id, t.name FROM users u JOIN teams t ON t.id = u.team_id
             WHERE u.id = ANY($1::int[]) AND u.team_id <> $2`, [ids, teamId]);
          for (const row of r.rows) homeTeams.set(row.id, row.name);
        } catch (e) { console.error("[team/members] home teams failed:", e); }
        try {
          // A shared member's groups in THIS team, not the ones from home.
          const r = await (pgAct as any).query(
            `SELECT user_id, group_scope FROM user_team_permissions WHERE team_id = $1 AND user_id = ANY($2::int[])`,
            [teamId, ids]);
          for (const row of r.rows) if (row.group_scope != null) extScopes.set(row.user_id, row.group_scope);
        } catch (e) { console.error("[team/members] per-team scopes failed:", e); }
      }

      const isTA = canManageTeam(req);
      const members = visible
        .map((u) => {
          const external = homeTeams.has(u.id);
          const act = counts.get(u.id);
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: (u as any).phone ?? null,
            isTeamAdmin: u.isTeamAdmin === 1 || (u.isTeamAdmin as unknown) === true,
            groupScope: (external ? extScopes.get(u.id) : u.groupScope) ?? u.groupScope ?? "",
            username: u.username ?? null,
            avatarUrl: u.avatarUrl ?? null,
            createdAt: u.createdAt ?? null,
            isExternal: external,
            homeTeamName: homeTeams.get(u.id) ?? null,
            testCount: act?.tests ?? 0,
            lastTestAt: act?.lastTest ?? null,
            lastSeen: isTA ? ((u as any).lastSeen ?? null) : undefined,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return res.json(members);
    } catch (err) {
      console.error("Failed to fetch team members:", err);
      return res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  // Alias used by My Account page
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const u = req.user!;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Both current and new password required" });
    const { verifyPassword, hashPassword: hp } = await import("./auth");
    const valid = await verifyPassword(currentPassword, u.password);
    if (!valid) return res.status(403).json({ message: "Current password is incorrect" });
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ message: pwError });
    const hashed = await hp(newPassword);
    await storage.updateUser(u.id, { password: hashed });
    res.json({ ok: true });
  });

  // Location history — unique locations from tests for the current team
  app.get("/api/locations/history", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    const { pool: pg } = await import("./db");
    try {
      // Optional ?sources=tests,weather,… — FILTER fields ask only for sources
      // that actually have data of that kind (a tests filter must not suggest
      // locations that only exist in weather logs); entry forms use the full
      // union as a typing aid.
      const SOURCE_TABLES: Record<string, string> = {
        tests: "tests", weather: "daily_weather", kick: "kick_tests", raceprep: "race_preps",
      };
      const requested = typeof req.query.sources === "string" && req.query.sources.trim() !== ""
        ? String(req.query.sources).split(",").map((s) => s.trim()).filter((s) => SOURCE_TABLES[s])
        : Object.keys(SOURCE_TABLES);
      const unions = requested
        .map((s) => `SELECT location FROM ${SOURCE_TABLES[s]} WHERE team_id = $1 AND location IS NOT NULL AND location != ''`)
        .join("\n           UNION\n           ");
      const result = await (pg as any).query(
        `SELECT DISTINCT location FROM (
           ${unions}
         ) AS all_locations
         ORDER BY location`,
        [teamId]
      );
      const locations = result.rows.map((r: any) => r.location as string).filter(Boolean);
      return res.json(locations);
    } catch {
      return res.json([]);
    }
  });

  // ── Brand statistics (Analytics) ────────────────────────────────────────────
  // Aggregates every brand represented in Glidr (products, structure tools, ski
  // brands) and ties each ski brand's parameters to results, feeling and the
  // linked weather/conditions, so waxers can learn how brands & grinds perform.
  app.get("/api/analytics/brands", requirePermission("analytics", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const [skisR, prodR, entriesR, testsR, weatherR, seriesR] = await Promise.all([
      (pool as any).query(
        `SELECT rs.id, rs.brand, rs.ski_id AS "skiId", rs.discipline, rs.construction, rs.mold, rs.base,
                rs.grind, rs.heights, rs.length, rs.type_of_ski AS "typeOfSki", rs.custom_params AS "customParams",
                a.name AS "athleteName"
         FROM race_skis rs JOIN athletes a ON a.id = rs.athlete_id
         WHERE a.team_id = $1 AND rs.archived_at IS NULL`, [teamId]),
      (pool as any).query(`SELECT id, brand, name, category FROM products WHERE team_id = $1 AND archived_at IS NULL`, [teamId]),
      (pool as any).query(
        `SELECT e.race_ski_id AS "raceSkiId", e.product_id AS "productId", e.rank_0km AS "rank0km",
                e.feeling_rank AS "feelingRank", e.test_id AS "testId"
         FROM test_entries e JOIN tests t ON t.id = e.test_id WHERE t.team_id = $1`, [teamId]),
      (pool as any).query(`SELECT id, weather_id AS "weatherId" FROM tests WHERE team_id = $1`, [teamId]),
      (pool as any).query(`SELECT id, air_temperature_c AS "airTemp", snow_type AS "snowType", track_hardness AS "trackHardness" FROM daily_weather WHERE team_id = $1`, [teamId]),
      (pool as any).query(`SELECT brand FROM test_ski_series WHERE team_id = $1 AND brand IS NOT NULL AND brand <> ''`, [teamId]),
    ]);

    const norm = (b: any) => String(b ?? "").trim();
    const skiById = new Map<number, any>(skisR.rows.map((s: any) => [s.id, s]));
    const prodById = new Map<number, any>(prodR.rows.map((p: any) => [p.id, p]));
    const weatherById = new Map<number, any>(weatherR.rows.map((w: any) => [w.id, w]));
    const testWeather = new Map<number, number | null>(testsR.rows.map((t: any) => [t.id, t.weatherId]));
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const tempBucket = (t: number | null): string | null => {
      if (t == null) return null;
      if (t < -10) return "< -10°C"; if (t < -5) return "-10…-5°C"; if (t < -2) return "-5…-2°C"; if (t < 0) return "-2…0°C"; return "0°C+";
    };

    type Acc = { brand: string; productCount: number; structureToolCount: number; raceSkiCount: number; seriesCount: number;
      skiAgg: Map<number, { ranks: number[]; feels: number[] }>;
      prodAgg: Map<number, { ranks: number[] }>;
      // param[category] -> value -> results. Categories are built dynamically so
      // every parameter a waxer has entered (incl. custom params) is covered.
      param: Record<string, Map<string, { ranks: number[]; feels: number[] }>>;
      cond: Map<string, { ranks: number[]; feels: number[] }>; };
    const brands = new Map<string, Acc>();
    const get = (b: string): Acc => {
      const key = b.toLowerCase();
      if (!brands.has(key)) brands.set(key, { brand: b, productCount: 0, structureToolCount: 0, raceSkiCount: 0, seriesCount: 0,
        skiAgg: new Map(), prodAgg: new Map(), param: {}, cond: new Map() });
      return brands.get(key)!;
    };

    for (const s of skisR.rows) { const b = norm(s.brand); if (b) { get(b).raceSkiCount++; } }
    for (const p of prodR.rows) { const b = norm(p.brand); if (b) { const a = get(b); a.productCount++; if (norm(p.category).toLowerCase().includes("structure")) a.structureToolCount++; } }
    for (const s of seriesR.rows) { const b = norm(s.brand); if (b) get(b).seriesCount++; }

    // Push a value into param[category]; creates the category map on demand.
    const pushParam = (a: Acc, category: string, v: any, rank: number | null, feel: number | null) => {
      const key = norm(v); if (!key) return;
      if (!a.param[category]) a.param[category] = new Map();
      const m = a.param[category];
      if (!m.has(key)) m.set(key, { ranks: [], feels: [] });
      const e = m.get(key)!; if (rank != null) e.ranks.push(rank); if (feel != null) e.feels.push(feel);
    };

    for (const e of entriesR.rows) {
      if (e.raceSkiId) {
        const ski = skiById.get(e.raceSkiId); if (!ski) continue;
        const b = norm(ski.brand); if (!b) continue;
        const a = get(b);
        if (!a.skiAgg.has(ski.id)) a.skiAgg.set(ski.id, { ranks: [], feels: [] });
        const sa = a.skiAgg.get(ski.id)!;
        if (e.rank0km != null) sa.ranks.push(e.rank0km);
        if (e.feelingRank != null) sa.feels.push(e.feelingRank);
        // Every parameter the waxers have filled in — standard + custom.
        pushParam(a, "Grind", ski.grind, e.rank0km, e.feelingRank);
        pushParam(a, "Base", ski.base, e.rank0km, e.feelingRank);
        pushParam(a, "Construction", ski.construction, e.rank0km, e.feelingRank);
        pushParam(a, "Mold", ski.mold, e.rank0km, e.feelingRank);
        pushParam(a, "Heights", ski.heights, e.rank0km, e.feelingRank);
        pushParam(a, "Length", ski.length, e.rank0km, e.feelingRank);
        pushParam(a, "Ski type", ski.typeOfSki, e.rank0km, e.feelingRank);
        pushParam(a, "Discipline", ski.discipline, e.rank0km, e.feelingRank);
        try {
          const cp = ski.customParams ? JSON.parse(ski.customParams) : {};
          for (const [k, val] of Object.entries(cp)) {
            if (k.startsWith("_")) continue;
            const label = k === "ra_value" ? "RA-value" : k.replace(/_/g, " ");
            pushParam(a, label, val, e.rank0km, e.feelingRank);
          }
        } catch {}
        const wId = testWeather.get(e.testId); const w = wId ? weatherById.get(wId) : null;
        const bucket = w ? tempBucket(w.airTemp) : null;
        if (bucket) { if (!a.cond.has(bucket)) a.cond.set(bucket, { ranks: [], feels: [] }); const c = a.cond.get(bucket)!; if (e.rank0km != null) c.ranks.push(e.rank0km); if (e.feelingRank != null) c.feels.push(e.feelingRank); }
      } else if (e.productId) {
        const p = prodById.get(e.productId); if (!p) continue;
        const b = norm(p.brand); if (!b) continue;
        const a = get(b);
        if (!a.prodAgg.has(p.id)) a.prodAgg.set(p.id, { ranks: [] });
        if (e.rank0km != null) a.prodAgg.get(p.id)!.ranks.push(e.rank0km);
      }
    }

    const breakdown = (m: Map<string, { ranks: number[]; feels: number[] }>) =>
      [...m.entries()].map(([value, v]) => ({ value, count: Math.max(v.ranks.length, v.feels.length), avgRank: avg(v.ranks), avgFeeling: avg(v.feels) }))
        .sort((x, y) => (x.avgRank ?? 99) - (y.avgRank ?? 99));

    const out = [...brands.values()].map((a) => {
      const allRanks: number[] = []; const allFeels: number[] = [];
      for (const v of a.skiAgg.values()) { allRanks.push(...v.ranks); allFeels.push(...v.feels); }
      const prodRanks: number[] = [];
      const productsPerf = [...a.prodAgg.entries()].map(([id, v]) => { prodRanks.push(...v.ranks); const p = prodById.get(id); return { name: `${p.brand} ${p.name}`, category: p.category, tests: v.ranks.length, avgRank: avg(v.ranks) }; })
        .sort((x, y) => (x.avgRank ?? 99) - (y.avgRank ?? 99));
      // Every parameter category, each with its values ranked by performance.
      const paramBreakdown = Object.entries(a.param)
        .map(([category, m]) => ({ category, values: breakdown(m) }))
        .filter((p) => p.values.length > 0)
        .sort((x, y) => x.category.localeCompare(y.category));
      return {
        brand: a.brand, productCount: a.productCount, structureToolCount: a.structureToolCount,
        raceSkiCount: a.raceSkiCount, seriesCount: a.seriesCount,
        raceTestEntries: allRanks.length + allFeels.length, productTestEntries: prodRanks.length,
        avgRank: avg(allRanks), avgFeeling: avg(allFeels), avgProductRank: avg(prodRanks),
        products: productsPerf,
        paramBreakdown,
        conditions: [...a.cond.entries()].map(([label, v]) => ({ label, count: Math.max(v.ranks.length, v.feels.length), avgRank: avg(v.ranks), avgFeeling: avg(v.feels) })),
      };
    }).sort((x, y) => x.brand.localeCompare(y.brand));

    res.json(out);
  });

  // Personal watch code — GET returns existing code (generates if missing), POST regenerates
  app.get("/api/auth/my-watch-code", requireAuth, async (req, res) => {
    const u = req.user!;
    const { pool } = await import("./db");
    const row = await (pool as any).query("SELECT watch_code FROM users WHERE id = $1", [u.id]);
    let code: string = row.rows[0]?.watch_code;
    if (!code) {
      // Generate a unique 4-digit code
      let attempts = 0;
      do {
        code = String(Math.floor(1000 + Math.random() * 9000));
        const conflict = await (pool as any).query("SELECT id FROM users WHERE watch_code = $1 AND id != $2", [code, u.id]);
        if (conflict.rows.length === 0) break;
        attempts++;
      } while (attempts < 20);
      await (pool as any).query("UPDATE users SET watch_code = $1 WHERE id = $2", [code, u.id]);
    }
    res.json({ watchCode: code });
  });

  app.post("/api/auth/my-watch-code/regenerate", requireAuth, async (req, res) => {
    const u = req.user!;
    const { pool } = await import("./db");
    let code: string;
    let attempts = 0;
    do {
      code = String(Math.floor(1000 + Math.random() * 9000));
      const conflict = await (pool as any).query("SELECT id FROM users WHERE watch_code = $1 AND id != $2", [code!, u.id]);
      if (conflict.rows.length === 0) break;
      attempts++;
    } while (attempts < 20);
    await (pool as any).query("UPDATE users SET watch_code = $1 WHERE id = $2", [code!, u.id]);
    res.json({ watchCode: code! });
  });

  // Resolve personal watch code → user name (used by Garmin app, no auth required)
  app.get("/api/watch/resolve-user/:code", async (req, res) => {
    const ipW = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    if (watchPinRateLimit(ipW)) return res.status(429).json({ message: "Too many attempts. Try again in 5 minutes." });
    const { code } = req.params;
    if (!/^\d{4}$/.test(code)) return res.status(400).json({ message: "Invalid code" });
    const { pool } = await import("./db");
    const row = await (pool as any).query(
      "SELECT id, name FROM users WHERE watch_code = $1 AND is_active = 1", [code]
    );
    if (!row.rows[0]) return res.status(404).json({ message: "Code not found" });
    res.json({ userId: row.rows[0].id, userName: row.rows[0].name });
  });

  // Grinding records
  app.get("/api/grinding", requirePermission("grinding", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listGrindingRecords(u.groupScope, u.isScopeAdmin, teamId);
    res.json(list);
  });

  app.post("/api/grinding", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const groupScope = resolveCreateGroupScope(req);
    const record = await storage.createGrindingRecord({
      seriesId: req.body.seriesId || null,
      date: req.body.date,
      grindType: req.body.grindType,
      stone: req.body.stone || null,
      notes: req.body.notes || null,
      createdAt: new Date().toISOString(),
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "grinding", entityId: record.id,
        details: `Grinding: ${record.grindType}`, createdAt: new Date().toISOString(), groupScope, teamId,
      });
    } catch (_) {}
    res.json(record);
  });

  app.put("/api/grinding/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindingRecord(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateGrindingRecord(id, {
      seriesId: req.body.seriesId,
      date: req.body.date,
      grindType: req.body.grindType,
      stone: req.body.stone || null,
      notes: req.body.notes || null,
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.delete("/api/grinding/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindingRecord(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteGrindingRecord(id);
    res.json({ ok: true });
  });

  app.get("/api/grinding-sheets", requirePermission("grinding", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const sheets = await storage.listGrindingSheets(u.groupScope, u.isScopeAdmin, teamId);
    res.json(sheets);
  });

  app.post("/api/grinding-sheets", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ message: "Name and URL are required" });
    if (!url.includes("docs.google.com")) return res.status(400).json({ message: "Only Google Sheets URLs are supported" });
    const sheet = await storage.createGrindingSheet({
      name,
      url,
      createdAt: new Date().toISOString(),
      createdById: u.id,
      createdByName: u.name,
      groupScope: u.groupScope.split(",")[0].trim(),
      teamId,
    });
    res.json(sheet);
  });

  app.put("/api/grinding-sheets/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindingSheet(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    if (!u.isScopeAdmin) {
      const scopes = u.groupScope.split(",").map((s: string) => s.trim());
      if (!scopes.includes(existing.groupScope)) return res.status(403).json({ message: "No access" });
    }
    const { name, url } = req.body;
    if (url && !url.includes("docs.google.com")) return res.status(400).json({ message: "Only Google Sheets URLs are supported" });
    const updated = await storage.updateGrindingSheet(id, { name, url });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.delete("/api/grinding-sheets/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindingSheet(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    if (!u.isScopeAdmin) {
      const scopes = u.groupScope.split(",").map((s: string) => s.trim());
      if (!scopes.includes(existing.groupScope)) return res.status(403).json({ message: "No access" });
    }
    const deleted = await storage.deleteGrindingSheet(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // Grind Profiles
  app.get("/api/grind-profiles", requirePermission("grinding", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const includeArchived = req.query.archived === "true";
    const profiles = await storage.listGrindProfiles(teamId, includeArchived);
    res.json(profiles);
  });

  // Bulk import: accepts an array of profile objects
  app.post("/api/grind-profiles/bulk", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const profiles: Array<{ name: string; grindType: string; extraParams?: Record<string, string>; notes?: string }> = req.body.profiles;
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return res.status(400).json({ message: "profiles array required" });
    }
    const { pool: pgBulk } = await import("./db");
    const maxRow = await (pgBulk as any).query(
      `SELECT grind_id FROM grind_profiles WHERE team_id = $1 AND grind_id IS NOT NULL ORDER BY grind_id DESC LIMIT 1`,
      [teamId]
    );
    let nextNum = maxRow.rows.length > 0 ? parseInt(maxRow.rows[0].grind_id) + 1 : 1;
    const created: any[] = [];
    for (const p of profiles) {
      if (!p.name || !p.grindType) continue;
      const grindId = String(nextNum++).padStart(3, "0");
      const stone = p.extraParams?.stone ?? "";
      const pattern = p.extraParams?.pattern ?? "";
      const profile = await storage.createGrindProfile({
        name: p.name, grindType: p.grindType,
        stone, pattern,
        extraParams: p.extraParams ? JSON.stringify(p.extraParams) : null,
        grindId,
        notes: p.notes ?? null,
        createdByName: u.name,
        teamId,
        createdAt: new Date().toISOString(),
      });
      created.push(profile);
    }
    res.json({ created: created.length });
  });

  app.post("/api/grind-profiles", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { name, grindType, stone, pattern, extraParams, notes, isUsGrind } = req.body;
    if (!name || !grindType) {
      return res.status(400).json({ message: "name and grindType are required" });
    }
    const { pool: pg2 } = await import("./db");
    const maxRow = await (pg2 as any).query(
      `SELECT grind_id FROM grind_profiles WHERE team_id = $1 AND grind_id IS NOT NULL ORDER BY grind_id DESC LIMIT 1`,
      [teamId]
    );
    const nextNum = maxRow.rows.length > 0 ? parseInt(maxRow.rows[0].grind_id) + 1 : 1;
    const grindId = String(nextNum).padStart(3, "0");
    const profile = await storage.createGrindProfile({
      name,
      grindType,
      stone,
      pattern,
      extraParams: extraParams ? JSON.stringify(extraParams) : null,
      grindId,
      notes: notes ?? null,
      isUsGrind: isUsGrind ? 1 : 0,
      createdByName: u.name,
      teamId,
      createdAt: new Date().toISOString(),
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "grind_profile", entityId: profile.id,
        details: `Grind profile: ${profile.name}`, createdAt: new Date().toISOString(),
        groupScope: u.groupScope.split(",")[0].trim(), teamId,
      });
    } catch (_) {}
    res.json(profile);
  });

  app.put("/api/grind-profiles/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindProfile(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const { name, grindType, stone, pattern, extraParams, notes, isUsGrind } = req.body;
    if (!name || !grindType) {
      return res.status(400).json({ message: "name and grindType are required" });
    }
    // Compute diff before updating
    const newExtraParams = extraParams ? JSON.stringify(extraParams) : null;
    const diffFields: { field: string; from: any; to: any }[] = [];
    if (existing.name !== name) diffFields.push({ field: "name", from: existing.name, to: name });
    if (existing.grindType !== grindType) diffFields.push({ field: "grindType", from: existing.grindType, to: grindType });
    if (existing.stone !== stone) diffFields.push({ field: "stone", from: existing.stone, to: stone });
    if (existing.pattern !== pattern) diffFields.push({ field: "pattern", from: existing.pattern, to: pattern });
    if ((existing.notes ?? null) !== (notes ?? null)) diffFields.push({ field: "notes", from: existing.notes ?? null, to: notes ?? null });
    if ((existing.extraParams ?? null) !== newExtraParams) diffFields.push({ field: "extraParams", from: existing.extraParams ?? null, to: newExtraParams });
    const updated = await storage.updateGrindProfile(id, {
      name,
      grindType,
      stone,
      pattern,
      extraParams: newExtraParams,
      notes: notes ?? null,
      ...(isUsGrind !== undefined ? { isUsGrind: isUsGrind ? 1 : 0 } : {}),
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "updated",
        entityType: "grind_profile", entityId: id,
        details: JSON.stringify({ changes: diffFields }),
        createdAt: new Date().toISOString(),
        groupScope: u.groupScope.split(",")[0].trim(), teamId,
      });
    } catch (_) {}
    res.json(updated);
  });

  app.post("/api/grind-profiles/:id/duplicate", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindProfile(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const { pool: pg3 } = await import("./db");
    const maxRowDup = await (pg3 as any).query(
      `SELECT grind_id FROM grind_profiles WHERE team_id = $1 AND grind_id IS NOT NULL ORDER BY grind_id DESC LIMIT 1`,
      [teamId]
    );
    const nextNumDup = maxRowDup.rows.length > 0 ? parseInt(maxRowDup.rows[0].grind_id) + 1 : 1;
    const grindIdDup = String(nextNumDup).padStart(3, "0");
    const copy = await storage.createGrindProfile({
      name: `${existing.name} (copy)`,
      grindType: existing.grindType,
      stone: existing.stone,
      pattern: existing.pattern,
      extraParams: existing.extraParams,
      grindId: grindIdDup,
      notes: existing.notes ?? null,
      createdByName: u.name,
      teamId,
      createdAt: new Date().toISOString(),
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "duplicated",
        entityType: "grind_profile", entityId: copy.id,
        details: `Duplicated grind profile: ${existing.name}`, createdAt: new Date().toISOString(),
        groupScope: u.groupScope.split(",")[0].trim(), teamId,
      });
    } catch (_) {}
    res.json(copy);
  });

  app.delete("/api/grind-profiles/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindProfile(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const deleted = await storage.deleteGrindProfile(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "deleted",
        entityType: "grind_profile", entityId: id,
        details: `Deleted grind profile: ${existing.name}`,
        createdAt: new Date().toISOString(),
        groupScope: u.groupScope.split(",")[0].trim(), teamId,
      });
    } catch (_) {}
    res.json({ ok: true });
  });

  app.patch("/api/grind-profiles/:id/archive", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindProfile(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const archived = req.body.archived === true ? 1 : 0;
    const updated = await storage.updateGrindProfile(id, { archived } as any);
    if (!updated) return res.status(404).json({ message: "Not found" });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name,
        action: archived === 1 ? "archived" : "restored",
        entityType: "grind_profile", entityId: id,
        details: `${archived === 1 ? "Archived" : "Restored"} grind profile: ${existing.name}`,
        createdAt: new Date().toISOString(),
        groupScope: u.groupScope.split(",")[0].trim(), teamId,
      });
    } catch (_) {}
    res.json(updated);
  });

  // Grind profile change log — returns activity log entries for this profile
  app.get("/api/grind-profiles/:id/changes", requirePermission("grinding", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const profileId = parseInt(req.params.id);
    const { pool: pgChanges } = await import("./db");
    const result = await (pgChanges as any).query(
      `SELECT id, user_id, user_name, action, details, created_at
       FROM activity_logs
       WHERE team_id = $1 AND entity_type = 'grind_profile' AND entity_id = $2
       ORDER BY created_at DESC LIMIT 100`,
      [teamId, profileId]
    );
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      action: r.action,
      details: r.details,
      createdAt: r.created_at,
    })));
  });

  // Grind profile test history — returns tests whose entries match this profile's grind params
  app.get("/api/grind-profiles/:id/tests", requirePermission("grinding", "view"), async (req, res) => {
    const isBlind = req.user!.isBlindTester === 1;
    const teamId = getActiveTeamId(req);
    const profileId = parseInt(req.params.id);
    const profile = await storage.getGrindProfile(profileId);
    if (!profile) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(profile, req)) return res.status(403).json({ message: "Forbidden" });

    const { pool: pg } = await import("./db");
    // Match tests where at least one entry references this grind profile:
    // 1. By direct ID link (grind_profile_id)
    // 2. By profile name stored in grind_type (case/space insensitive)
    // 3. By grind type name stored in grind_type (for older entries before profile IDs were used)
    const result = await (pg as any).query(
      `SELECT DISTINCT
         t.id, t.date, t.location, t.test_name, t.weather_id, t.test_type, t.notes,
         t.distance_labels, t.distance_label_0km, t.distance_label_xkm,
         t.series_id, t.created_by_name, t.created_at, t.group_scope,
         w.air_temperature_c, w.snow_temperature_c, w.air_humidity_pct as humidity, w.snow_type as weather_type
       FROM test_entries te
       JOIN tests t ON t.id = te.test_id
       LEFT JOIN daily_weather w ON w.id = t.weather_id
       WHERE t.team_id = $1
         AND (
           te.grind_profile_id = $2
           OR LOWER(TRIM(te.grind_type)) = LOWER(TRIM($3))
           OR LOWER(TRIM(te.grind_type)) = LOWER(TRIM($4))
         )
       ORDER BY t.date DESC, t.id DESC`,
      [teamId, profile.id, profile.name, profile.grindType]
    );

    // Fetch ALL entries for the matching tests (same pattern as product history)
    const testIds: number[] = result.rows.map((r: any) => r.id);
    let entriesByTestId: Record<number, any[]> = {};
    if (testIds.length > 0) {
      const entryRows = await (pg as any).query(
        `SELECT te.id, te.test_id, te.ski_number, te.product_id, te.additional_product_ids,
                te.race_ski_id, te.methodology,
                te.result_0km_cm_behind, te.rank_0km, te.result_xkm_cm_behind, te.rank_xkm,
                te.results, te.feeling_rank, te.kick_rank,
                te.grind_type, te.grind_stone, te.grind_pattern, te.grind_extra_params, te.grind_profile_id,
                rs.ski_id as ski_model, rs.brand as ski_brand
         FROM test_entries te
         LEFT JOIN race_skis rs ON rs.id = te.race_ski_id
         WHERE te.test_id = ANY($1)
         ORDER BY te.ski_number ASC`,
        [testIds]
      );
      for (const e of entryRows.rows) {
        if (!entriesByTestId[e.test_id]) entriesByTestId[e.test_id] = [];
        const isSelectedGrind =
          e.grind_profile_id === profile.id ||
          (e.grind_type && e.grind_type.trim().toLowerCase() === profile.name.trim().toLowerCase()) ||
          (e.grind_type && e.grind_type.trim().toLowerCase() === profile.grindType.trim().toLowerCase());
        entriesByTestId[e.test_id].push({
          id: e.id, testId: e.test_id, skiNumber: e.ski_number,
          productId: isBlind ? null : e.product_id,
          additionalProductIds: isBlind ? null : e.additional_product_ids,
          raceSkiId: e.race_ski_id, skiModel: e.ski_model, skiBrand: e.ski_brand,
          methodology: isBlind ? null : e.methodology,
          result0kmCmBehind: e.result_0km_cm_behind, rank0km: e.rank_0km,
          resultXkmCmBehind: e.result_xkm_cm_behind, rankXkm: e.rank_xkm,
          results: e.results, feelingRank: e.feeling_rank, kickRank: e.kick_rank,
          grindType: e.grind_type, grindStone: e.grind_stone,
          grindPattern: e.grind_pattern, grindExtraParams: e.grind_extra_params,
          grindProfileId: e.grind_profile_id,
          isSelectedGrind,
        });
      }
    }

    const tests = result.rows.map((r: any) => ({
      id: r.id, date: r.date, location: r.location, testName: r.test_name,
      weatherId: r.weather_id, testType: r.test_type, notes: r.notes,
      distanceLabels: r.distance_labels, distanceLabel0km: r.distance_label_0km,
      distanceLabelXkm: r.distance_label_xkm, seriesId: r.series_id,
      createdByName: r.created_by_name, createdAt: r.created_at, groupScope: r.group_scope,
      weather: r.weather_id ? {
        airTemperatureC: r.air_temperature_c, snowTemperatureC: r.snow_temperature_c,
        humidity: r.humidity, weatherType: r.weather_type,
      } : null,
      entries: entriesByTestId[r.id] || [],
    }));

    res.json({ profile, tests });
  });

  // Admin stats
  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getAdminTeamScope(req);
    const [userCount, testCount, productCount, seriesCount, weatherCount, grindingCount, loginCount, activityCount] = await Promise.all([
      storage.countTable("users", teamId),
      storage.countTable("tests", teamId),
      storage.countTable("products", teamId),
      storage.countTable("testSkiSeries", teamId),
      storage.countTable("dailyWeather", teamId),
      storage.countTable("grindingRecords", teamId),
      storage.countTable("loginLogs", teamId),
      storage.countTable("activityLogs", teamId),
    ]);
    res.json({ userCount, testCount, productCount, seriesCount, weatherCount, grindingCount, loginCount, activityCount });
  });

  // SA only: serve the Glidr pitch deck
  app.get("/api/admin/presentation", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    try {
      const html = await readFile(join(process.cwd(), "glidr-presentasjon.html"), "utf-8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(html);
    } catch {
      res.status(404).json({ message: "Presentation file not found" });
    }
  });

  // Public shareable link — no login required, token acts as the secret
  const PRESENTATION_TOKEN = process.env.PRESENTATION_TOKEN ?? null;
  app.get(`/p/:token`, async (req, res) => {
    if (!PRESENTATION_TOKEN) return res.status(404).json({ message: "Not found" });
    if (req.params.token !== PRESENTATION_TOKEN) return res.status(404).json({ message: "Not found" });
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    try {
      const html = await readFile(join(process.cwd(), "glidr-presentasjon.html"), "utf-8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(html);
    } catch {
      res.status(404).send("Not found");
    }
  });

  app.get("/api/admin/full-export", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getActiveTeamId(req);
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "exported_full_data",
        entityType: "team", entityId: teamId,
        details: `Full data export`, createdAt: new Date().toISOString(),
        groupScope: u.groupScope.split(",")[0].trim(), teamId,
      });
    } catch (_) {}
    const [allTests, allWeather, allSeries, allProducts, allUsers, allGroups, allLoginLogs, allActivities, allAthletes] = await Promise.all([
      storage.listAllTestsForTeam(teamId),
      storage.listAllWeatherForTeam(teamId),
      storage.listSeries(u.groupScope, true, teamId),
      storage.listProducts(u.groupScope, true, teamId),
      storage.listUsers(teamId),
      storage.listGroups(teamId),
      storage.listLoginLogs(teamId),
      // Terms-acceptance records are owner-level compliance data — SA only.
      storage.listActivityLogs(5000, teamId).then((ls: any[]) => u.isAdmin ? ls : ls.filter((l: any) => l.action !== "accepted_terms" && l.action !== "terms_reset" && l.action !== "login_log_deleted")),
      storage.listAthletes(u.id, true, teamId),
    ]);
    const testIds = allTests.map((t: any) => t.id);
    const allEntries = await storage.listAllEntriesForTests(testIds);
    const entriesByTest: Record<number, any[]> = {};
    for (const e of allEntries) {
      if (!entriesByTest[e.testId]) entriesByTest[e.testId] = [];
      entriesByTest[e.testId].push(e);
    }
    // Parallell henting av race-ski per atlet (unngår N+1 sekvensiell loop)
    const allRaceSkisNested = await Promise.all(
      allAthletes.map((ath: any) =>
        storage.listAllRaceSkisIncludingArchived(ath.id)
          .then((skis) => skis.map((s) => ({ ...s, athleteName: ath.name })))
      )
    );
    const allRaceSkis: any[] = allRaceSkisNested.flat();

    const [grindingRecords, grindingSheetsList] = await Promise.all([
      storage.listGrindingRecords(u.groupScope, true, teamId),
      storage.listGrindingSheets(u.groupScope, true, teamId),
    ]);

    // Parallell henting av regrinds (unngår N+1)
    const [raceSkiRegrindsNested, testSkiRegrindsNested] = await Promise.all([
      Promise.all(
        allRaceSkis.map((ski: any) =>
          storage.listRaceSkiRegrinds(ski.id)
            .then((rs) => rs.map((r) => ({ ...r, skiId: ski.skiId, athleteName: ski.athleteName, brand: ski.brand })))
        )
      ),
      Promise.all(
        allSeries.map((series: any) =>
          storage.listTestSkiRegrinds(series.id)
            .then((rs) => rs.map((r) => ({ ...r, seriesName: series.name })))
        )
      ),
    ]);
    const allRaceSkiRegrinds: any[] = raceSkiRegrindsNested.flat();
    const allTestSkiRegrinds: any[] = testSkiRegrindsNested.flat();
    const grindProfilesList = await storage.listGrindProfiles(teamId);
    const racePrepsResult = await (pool as any).query(
      `SELECT id, date, start_time, location, race_type, discipline,
              products, method, structure, notes, tette,
              product_ids, structure_ids, kick_product_ids, product_apps, structure_apps,
              weather_id, created_by_name, created_at
       FROM race_preps WHERE team_id = $1 ORDER BY date DESC`,
      [teamId]
    );
    const racePrepEntriesResult = await (pool as any).query(
      `SELECT rpe.id, rpe.race_prep_id, rpe.athlete_name, rpe.ski_id,
              rpe.ski_id_classic, rpe.ski_id_skating,
              rpe.waxer_name, rpe.notes, rpe.created_at
       FROM race_prep_entries rpe
       JOIN race_preps rp ON rp.id = rpe.race_prep_id
       WHERE rp.team_id = $1 ORDER BY rpe.race_prep_id, rpe.athlete_name`,
      [teamId]
    );
    res.json({
      tests: allTests,
      entriesByTest,
      weather: allWeather,
      series: allSeries,
      products: allProducts,
      users: allUsers.map(({ password, termsAcceptedAt, termsAcceptedVersion, ...rest }: any) =>
        u.isAdmin ? { ...rest, termsAcceptedAt, termsAcceptedVersion } : rest),
      groups: allGroups,
      loginLogs: allLoginLogs,
      activities: allActivities,
      athletes: allAthletes,
      raceSkis: allRaceSkis,
      grindingRecords,
      grindingSheets: grindingSheetsList,
      raceSkiRegrinds: allRaceSkiRegrinds,
      testSkiRegrinds: allTestSkiRegrinds,
      grindProfiles: grindProfilesList,
      racePreps: racePrepsResult.rows,
      racePrepEntries: racePrepEntriesResult.rows,
    });
  });

  app.post("/api/log-export", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { exportType, details } = req.body;
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: `exported_${exportType || "unknown"}`,
        entityType: "team", entityId: teamId,
        details: details || exportType || "export",
        createdAt: new Date().toISOString(),
        groupScope: u.groupScope.split(",")[0].trim(), teamId,
      });
    } catch (_) {}
    res.json({ ok: true });
  });

  // Import for the complete (format 2) JSON export: every data area, with
  // duplicate detection on natural keys and foreign-key remapping so a file
  // from another install (or an older backup) lands cleanly in THIS team.
  app.post("/api/admin/import-v2", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const u = userInfo(req);
    const teamId = getActiveTeamId(req) ?? u.teamId;
    const tables = req.body?.tables;
    const areas: string[] | null = Array.isArray(req.body?.areas) ? req.body.areas : null;
    if (!tables || typeof tables !== "object") return res.status(400).json({ message: "Invalid import file (expected format 2 with a tables object)" });
    const { pool: pImp } = await import("./db");

    const colCache = new Map<string, string[]>();
    const colsOf = async (t: string): Promise<string[]> => {
      if (!colCache.has(t)) {
        const r = await (pImp as any).query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [t]);
        colCache.set(t, r.rows.map((x: any) => x.column_name));
      }
      return colCache.get(t)!;
    };

    const counts: Record<string, number> = {};
    let skipped = 0;
    let errors = 0;

    // ID maps: old id in the file → id in this database (deduped or inserted).
    const maps: Record<string, Map<any, number>> = {
      products: new Map(), test_ski_series: new Map(), daily_weather: new Map(),
      grind_profiles: new Map(), athletes: new Map(), race_skis: new Map(),
      kick_skis: new Map(), kick_tests: new Map(), race_preps: new Map(), tests: new Map(),
    };

    // Ordered import plan. keys = natural key for duplicate detection (checked
    // AFTER fk remap); fk maps old references to this database; requiredFk rows
    // are skipped when the reference can't be resolved, optional fks are nulled.
    const SPECS: { area: string; table: string; keys: string[]; fk?: Record<string, string>; requiredFk?: string[]; defaults?: Record<string, any> }[] = [
      { area: "products",   table: "products",          keys: ["brand", "name"] },
      { area: "testfleets", table: "test_ski_series",   keys: ["name", "type"] },
      { area: "testfleets", table: "test_ski_regrinds", keys: ["series_id", "date"], fk: { series_id: "test_ski_series" }, requiredFk: ["series_id"] },
      { area: "weather",    table: "daily_weather",     keys: ["date", "location"] },
      { area: "grinding",   table: "grind_profiles",    keys: ["name"] },
      { area: "athletes",   table: "athletes",          keys: ["name"] },
      { area: "athletes",   table: "race_skis",         keys: ["athlete_id", "ski_id"], fk: { athlete_id: "athletes" }, requiredFk: ["athlete_id"] },
      { area: "athletes",   table: "race_ski_regrinds", keys: ["race_ski_id", "date"], fk: { race_ski_id: "race_skis" }, requiredFk: ["race_ski_id"] },
      { area: "athletes",   table: "ski_race_usages",   keys: ["ski_id", "date"], fk: { ski_id: "race_skis", athlete_id: "athletes" }, requiredFk: ["ski_id"] },
      { area: "kick",       table: "kick_skis",         keys: ["name"] },
      { area: "kick",       table: "kick_mixes",        keys: ["name"] },
      { area: "kick",       table: "kick_tests",        keys: ["date", "location"] },
      { area: "kick",       table: "kick_test_entries", keys: ["kick_test_id", "kick_ski_id"], fk: { kick_test_id: "kick_tests", kick_ski_id: "kick_skis" }, requiredFk: ["kick_test_id", "kick_ski_id"] },
      { area: "raceprep",   table: "race_preps",        keys: ["date", "location"] },
      { area: "raceprep",   table: "race_prep_entries", keys: ["race_prep_id", "athlete_id"], fk: { race_prep_id: "race_preps", athlete_id: "athletes" }, requiredFk: ["race_prep_id"] },
      { area: "tests",      table: "tests",             keys: ["date", "location", "created_at"], fk: { series_id: "test_ski_series", athlete_id: "athletes", weather_id: "daily_weather" } },
      { area: "tests",      table: "test_entries",      keys: ["test_id", "ski_number"], fk: { test_id: "tests", product_id: "products", race_ski_id: "race_skis" }, requiredFk: ["test_id"] },
      // Children of the rows above — restored so a disaster recovery loses nothing.
      { area: "tests",      table: "test_comments",     keys: ["test_id", "user_id", "content"], fk: { test_id: "tests" }, requiredFk: ["test_id"] },
      // Attachment binaries are stripped from exports; restore metadata with an
      // empty body so the record (filename, uploader, date) survives.
      { area: "tests",      table: "test_attachments",  keys: ["test_id", "filename", "created_at"], fk: { test_id: "tests" }, requiredFk: ["test_id"], defaults: { data: "" } },
      { area: "grinding",   table: "grinding_records",  keys: ["date", "grind_type", "created_at"], fk: { series_id: "test_ski_series" } },
      { area: "grinding",   table: "grinding_sheets",   keys: ["name", "url"] },
      { area: "runsheets",  table: "runsheets",         keys: ["test_id", "label"], fk: { test_id: "tests" }, requiredFk: ["test_id"] },
      { area: "athletes",   table: "athlete_race_calendar", keys: ["athlete_id", "date", "race_name"], fk: { athlete_id: "athletes" }, requiredFk: ["athlete_id"] },
      { area: "athletes",   table: "feedback_links",    keys: ["token"], fk: { athlete_id: "athletes" }, requiredFk: ["athlete_id"] },
      { area: "raceprep",   table: "race_prep_comments", keys: ["race_prep_id", "user_id", "content"], fk: { race_prep_id: "race_preps" }, requiredFk: ["race_prep_id"] },
    ];

    const keyOf = (row: any, keys: string[]) => keys.map((k) => String(row[k] ?? "").toLowerCase()).join("|");

    for (const spec of SPECS) {
      if (areas && !areas.includes(spec.area)) continue;
      const rows = Array.isArray(tables[spec.table]) ? tables[spec.table] : [];
      if (rows.length === 0) continue;
      const valid = await colsOf(spec.table);
      if (valid.length === 0) continue;
      const hasTeam = valid.includes("team_id");

      const existing = await (pImp as any).query(
        `SELECT * FROM "${spec.table}"${hasTeam ? " WHERE team_id = $1" : ""}`,
        hasTeam ? [teamId] : []);
      const exByKey = new Map<string, number>(existing.rows.map((r: any) => [keyOf(r, spec.keys), r.id]));

      for (const raw of rows) {
        try {
          const row: Record<string, any> = {};
          for (const [k, v] of Object.entries(raw)) {
            if (k !== "id" && valid.includes(k)) row[k] = v;
          }
          // Remap foreign keys to THIS database's ids.
          let unresolvable = false;
          for (const [col, refTable] of Object.entries(spec.fk ?? {})) {
            const old = (raw as any)[col];
            if (old == null) continue;
            const mapped = maps[refTable]?.get(old);
            if (mapped != null) row[col] = mapped;
            else if (spec.requiredFk?.includes(col)) { unresolvable = true; break; }
            else row[col] = null;
          }
          if (unresolvable) { skipped++; continue; }
          for (const [dc, dv] of Object.entries(spec.defaults ?? {})) {
            if (row[dc] === undefined && valid.includes(dc)) row[dc] = dv;
          }
          if (hasTeam) row.team_id = teamId;

          const k = keyOf(row, spec.keys);
          const existingId = exByKey.get(k);
          if (existingId != null) {
            maps[spec.table]?.set((raw as any).id, existingId);
            skipped++;
            continue;
          }
          const cols = Object.keys(row);
          const r2 = await (pImp as any).query(
            `INSERT INTO "${spec.table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
            cols.map((c) => row[c]));
          const nid = r2.rows[0]?.id;
          if (nid != null) {
            maps[spec.table]?.set((raw as any).id, nid);
            exByKey.set(k, nid);
            counts[spec.table] = (counts[spec.table] ?? 0) + 1;
          }
        } catch (e) { errors++; }
      }
    }

    await storage.createActivityLog({
      userId: u.id, userName: u.name, action: "imported_data",
      entityType: "team", entityId: teamId,
      details: `JSON import (v2): ${Object.entries(counts).map(([t, n]) => `${t}:${n}`).join(", ") || "nothing new"} — ${skipped} duplicates skipped${errors ? `, ${errors} rows failed` : ""}`,
      createdAt: new Date().toISOString(), groupScope: "", teamId,
    } as any).catch(() => {});

    // A restore must never be silently partial: list every table present in
    // the file that this import does not write, with the reason.
    const NEVER_IMPORTED: Record<string, string> = {
      users: "accounts are never imported", groups: "accounts are never imported",
      user_teams: "accounts are never imported", user_team_permissions: "accounts are never imported",
      activity_logs: "history stays in the export file", login_logs: "history stays in the export file",
      inbox_messages: "history stays in the export file", invitations: "accounts are never imported",
      runsheet_progress: "live state — rebuilt in use", watch_queue: "live state — rebuilt in use",
      watch_sessions: "live state — rebuilt in use",
      teams: "team settings are managed in Admin", billing_records: "billing is managed by the owner",
      app_settings: "system settings", plan_change_log: "billing is managed by the owner",
    };
    const specTables = new Set(SPECS.map((sp) => sp.table));
    const notRestored = Object.keys(tables)
      .filter((t) => Array.isArray(tables[t]) && tables[t].length > 0 && !specTables.has(t))
      .map((t) => ({ table: t, reason: NEVER_IMPORTED[t] ?? "not covered by import — data kept only in the export file" }));

    res.json({ ok: true, imported: counts, skipped, errors, notRestored });
  });

  app.post("/api/admin/import", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const u = userInfo(req);
    const teamId = getActiveTeamId(req) ?? u.teamId;
    const data = req.body;

    if (!data || typeof data !== "object") {
      return res.status(400).json({ message: "Invalid import data" });
    }

    const result = { series: 0, products: 0, tests: 0, entries: 0, weather: 0, skipped: 0 };

    // Import series
    const seriesIdMap: Record<number, number> = {};
    if (Array.isArray(data.series)) {
      const existingSeries = await storage.listSeries(u.groupScope, true, teamId);
      for (const s of data.series) {
        const exists = existingSeries.find((e) => e.name === s.name && e.type === s.type);
        if (exists) {
          seriesIdMap[s.id] = exists.id;
          result.skipped++;
        } else {
          const created = await storage.createSeries({
            name: s.name,
            type: s.type,
            brand: s.brand || null,
            skiType: s.skiType || null,
            grind: s.grind || null,
            numberOfSkis: s.numberOfSkis ?? 8,
            lastRegrind: s.lastRegrind || null,
            createdAt: new Date().toISOString(),
            createdById: u.id,
            createdByName: u.name,
            groupScope: s.groupScope || u.groupScope,
            teamId,
            pairLabels: s.pairLabels || null,
            archivedAt: null,
          });
          seriesIdMap[s.id] = created.id;
          result.series++;
        }
      }
    }

    // Import products
    const productIdMap: Record<number, number> = {};
    if (Array.isArray(data.products)) {
      const existingProducts = await storage.listProducts(u.groupScope, true, teamId);
      for (const p of data.products) {
        const exists = existingProducts.find((e) => e.brand === p.brand && e.name === p.name);
        if (exists) {
          productIdMap[p.id] = exists.id;
          result.skipped++;
        } else {
          const created = await storage.createProduct({
            category: p.category || "Other",
            brand: p.brand || "",
            name: p.name,
            createdAt: new Date().toISOString(),
            createdById: u.id,
            createdByName: u.name,
            groupScope: p.groupScope || u.groupScope,
            teamId,
            stockQuantity: p.stockQuantity ?? 0,
          });
          productIdMap[p.id] = created.id;
          result.products++;
        }
      }
    }

    // Import tests + entries
    if (Array.isArray(data.tests)) {
      const existingTests = await storage.listTests(u.groupScope, true, teamId);
      for (const t of data.tests) {
        const exists = existingTests.find(
          (e) => e.date === t.date && e.location === t.location && e.testType === t.testType
        );
        if (exists) {
          result.skipped++;
          continue;
        }
        const newSeriesId = t.seriesId ? (seriesIdMap[t.seriesId] ?? t.seriesId) : null;
        const created = await storage.createTest({
          date: t.date,
          location: t.location,
          testName: t.testName || null,
          weatherId: null,
          testType: t.testType,
          testSkiSource: t.testSkiSource || "series",
          seriesId: newSeriesId,
          athleteId: t.athleteId || null,
          notes: t.notes || null,
          grindParameters: t.grindParameters || null,
          distanceLabel0km: t.distanceLabel0km || null,
          distanceLabelXkm: t.distanceLabelXkm || null,
          distanceLabels: t.distanceLabels || null,
          createdAt: new Date().toISOString(),
          createdById: u.id,
          createdByName: u.name,
          groupScope: t.groupScope || u.groupScope,
          teamId,
        });
        result.tests++;

        const entries = data.entriesByTest?.[t.id] ?? [];
        for (const e of entries) {
          const newProductId = e.productId ? (productIdMap[e.productId] ?? null) : null;
          const additionalIds = e.additionalProductIds
            ? e.additionalProductIds.split(",").map((id: string) => {
                const n = parseInt(id);
                return productIdMap[n] ?? n;
              }).join(",")
            : null;
          await storage.createEntry({
            testId: created.id,
            skiNumber: e.skiNumber,
            productId: newProductId,
            additionalProductIds: additionalIds,
            freeTextProduct: e.freeTextProduct || null,
            methodology: e.methodology || "",
            result0kmCmBehind: e.result0kmCmBehind ?? null,
            rank0km: e.rank0km ?? null,
            resultXkmCmBehind: e.resultXkmCmBehind ?? null,
            rankXkm: e.rankXkm ?? null,
            results: e.results || null,
            feelingRank: e.feelingRank ?? null,
            kickRank: e.kickRank ?? null,
            grindType: e.grindType || null,
            grindStone: e.grindStone || null,
            grindPattern: e.grindPattern || null,
            grindExtraParams: e.grindExtraParams || null,
            raceSkiId: null,
            createdAt: new Date().toISOString(),
            createdById: u.id,
            createdByName: u.name,
            groupScope: e.groupScope || u.groupScope,
            teamId,
          });
          result.entries++;
        }
      }
    }

    // Import weather
    if (Array.isArray(data.weather)) {
      for (const w of data.weather) {
        const exists = await storage.findWeather(w.date, w.location, w.groupScope || u.groupScope, teamId);
        if (exists) {
          result.skipped++;
          continue;
        }
        await storage.createWeather({
          date: w.date,
          time: w.time || "12:00",
          location: w.location,
          snowTemperatureC: w.snowTemperatureC,
          airTemperatureC: w.airTemperatureC,
          snowHumidityPct: w.snowHumidityPct,
          airHumidityPct: w.airHumidityPct,
          clouds: w.clouds ?? null,
          visibility: w.visibility || null,
          wind: w.wind || null,
          precipitation: w.precipitation || null,
          artificialSnow: w.artificialSnow || null,
          naturalSnow: w.naturalSnow || null,
          grainSize: w.grainSize || null,
          snowHumidityType: w.snowHumidityType || null,
          trackHardness: w.trackHardness || null,
          testQuality: w.testQuality ?? null,
          createdAt: new Date().toISOString(),
          createdById: u.id,
          createdByName: u.name,
          groupScope: w.groupScope || u.groupScope,
          teamId,
        });
        result.weather++;
      }
    }

    res.json({ ok: true, imported: result });
  });

  app.post("/api/admin/purge-activity-logs", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const beforeDate = req.body.beforeDate;
    if (!beforeDate) return res.status(400).json({ message: "beforeDate required" });
    // Super admins purge only their active team; team admins always scoped to their team
    const teamId = getActiveTeamId(req);
    const count = await storage.purgeOldActivityLogs(beforeDate, teamId);
    res.json({ deleted: count });
  });

  app.post("/api/admin/purge-login-logs", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const beforeDate = req.body.beforeDate;
    if (!beforeDate) return res.status(400).json({ message: "beforeDate required" });
    // Super admins purge only their active team; team admins always scoped to their team
    const teamId = getActiveTeamId(req);
    const count = await storage.purgeOldLoginLogs(beforeDate, teamId);
    res.json({ deleted: count });
  });

  app.post("/api/admin/force-logout-all", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const { pool } = await import("./db");
    const mySessionId = (req.session as any)?.id;
    if ((req.user as any).isAdmin === 1) {
      await (pool as any).query(`DELETE FROM user_sessions WHERE sess::jsonb -> 'passport' ->> 'user' != $1`, [String(u.id)]);
    } else {
      // Team admin: only their own team's users.
      const members = await (pool as any).query(`SELECT id FROM users WHERE team_id = $1 AND id != $2`, [getActiveTeamId(req), u.id]);
      const memberIds = members.rows.map((r: any) => String(r.id));
      if (memberIds.length > 0) {
        await (pool as any).query(`DELETE FROM user_sessions WHERE sess::jsonb -> 'passport' ->> 'user' = ANY($1::text[])`, [memberIds]);
      }
    }
    res.json({ ok: true });
  });

  app.get("/api/admin/db-stats", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const { pool } = await import("./db");
    const sessionResult = await (pool as any).query(`SELECT count(*) as count FROM user_sessions`);
    const sessionCount = parseInt(sessionResult.rows[0]?.count || "0");
    const teamId = getAdminTeamScope(req);
    const [userCount, testCount, productCount, seriesCount, weatherCount, grindingCount, loginCount, activityCount, athleteCount, raceSkiCount] = await Promise.all([
      storage.countTable("users", teamId),
      storage.countTable("tests", teamId),
      storage.countTable("products", teamId),
      storage.countTable("testSkiSeries", teamId),
      storage.countTable("dailyWeather", teamId),
      storage.countTable("grindingRecords", teamId),
      storage.countTable("loginLogs", teamId),
      storage.countTable("activityLogs", teamId),
      storage.countTable("athletes", teamId),
      storage.countTable("raceSkis", teamId),
    ]);
    res.json({ sessionCount, userCount, testCount, productCount, seriesCount, weatherCount, grindingCount, loginCount, activityCount, athleteCount, raceSkiCount });
  });

  // Admin force logout user (delete their sessions)
  app.post("/api/admin/force-logout/:userId", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
    const targetId = parseInt(req.params.userId);
    if (!u.isAdmin) {
      const tUser = await storage.getUser(targetId);
      if (!tUser || tUser.teamId !== getActiveTeamId(req)) {
        return res.status(403).json({ message: "Cannot manage users outside your team" });
      }
    }
    const { pool } = await import("./db");
    await (pool as any).query(`DELETE FROM user_sessions WHERE sess::jsonb -> 'passport' ->> 'user' = $1`, [String(targetId)]);
    res.json({ ok: true });
  });

  // ── User history (SA or Team Admin managing the user's team) ─────────────────
  app.get("/api/admin/users/:id/history", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin && !canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const targetId = parseInt(req.params.id);
    const rawDays = parseInt(req.query.days as string) || 30;
    const days = Math.min(Math.max(rawDays, 1), 90);
    const { pool: pg } = await import("./db");

    // Team admins may only view history for users in their own team
    if (!u.isAdmin) {
      const targetUser = await storage.getUser(targetId);
      if (!targetUser || targetUser.teamId !== u.teamId) {
        return res.status(403).json({ message: "Cannot view history for users outside your team" });
      }
    }

    // login_at / created_at are stored as ISO text; ISO-8601 sorts chronologically
    // as text, so compare against an ISO threshold (avoids text-vs-timestamp errors).
    const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
    const [loginResult, activityResult] = await Promise.all([
      (pg as any).query(
        `SELECT id, user_id, email, name, login_at, ip_address, action, details
         FROM login_logs WHERE user_id = $1 AND login_at >= $2 AND action = 'login' ORDER BY login_at DESC LIMIT 200`,
        [targetId, sinceIso]
      ),
      (pg as any).query(
        `SELECT id, user_id, user_name, action, entity_type, entity_id, details, created_at, team_id
         FROM activity_logs WHERE user_id = $1 AND created_at >= $2 AND action NOT IN ('accepted_terms','terms_reset','login_log_deleted') ORDER BY created_at DESC LIMIT 200`,
        [targetId, sinceIso]
      ),
    ]);

    const loginLogs = loginResult.rows.map((r: any) => ({
      id: r.id, userId: r.user_id, email: r.email, name: r.name,
      loginAt: r.login_at, ipAddress: r.ip_address, action: r.action, details: r.details,
    }));

    const activityLogs = activityResult.rows.map((r: any) => ({
      id: r.id, userId: r.user_id, userName: r.user_name, action: r.action,
      entityType: r.entity_type, entityId: r.entity_id, details: r.details,
      createdAt: r.created_at, teamId: r.team_id,
    }));

    const passwordChanges = activityLogs.filter((l: any) =>
      l.action === "password_changed" || l.action === "password_reset" || l.entityType === "password"
    );

    res.json({ loginLogs, activityLogs, passwordChanges });
  });

  // ── Team member activity (any authenticated user, same-team only) ───────────
  app.get("/api/team/members/:id/activity", requireAuth, async (req, res) => {
    const u = userInfo(req);
    // Activity (incl. login IPs) is admin-grade information.
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const targetId = parseInt(req.params.id);
    const rawDays = parseInt(req.query.days as string) || 30;
    const days = Math.min(Math.max(rawDays, 1), 90);
    const { pool: pg } = await import("./db");

    // Verify the target user belongs to the same team as the requester
    const targetUser = await storage.getUser(targetId);
    if (!targetUser || (!u.isAdmin && targetUser.teamId !== getActiveTeamId(req))) {
      return res.status(403).json({ message: "Cannot view activity for users outside your team" });
    }

    // login_at / created_at are stored as ISO text; ISO-8601 sorts chronologically
    // as text, so compare against an ISO threshold (avoids text-vs-timestamp errors).
    const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
    const [loginResult, activityResult] = await Promise.all([
      (pg as any).query(
        `SELECT id, user_id, email, name, login_at, ip_address, action, details
         FROM login_logs WHERE user_id = $1 AND login_at >= $2 AND action = 'login' ORDER BY login_at DESC LIMIT 200`,
        [targetId, sinceIso]
      ),
      (pg as any).query(
        `SELECT id, user_id, user_name, action, entity_type, entity_id, details, created_at, team_id
         FROM activity_logs WHERE user_id = $1 AND created_at >= $2 AND action NOT IN ('accepted_terms','terms_reset','login_log_deleted') ORDER BY created_at DESC LIMIT 200`,
        [targetId, sinceIso]
      ),
    ]);

    const loginLogs = loginResult.rows.map((r: any) => ({
      id: r.id, userId: r.user_id, email: r.email, name: r.name,
      loginAt: r.login_at, ipAddress: r.ip_address, action: r.action, details: r.details,
    }));

    const activityLogs = activityResult.rows.map((r: any) => ({
      id: r.id, userId: r.user_id, userName: r.user_name, action: r.action,
      entityType: r.entity_type, entityId: r.entity_id, details: r.details,
      createdAt: r.created_at, teamId: r.team_id,
    }));

    const passwordChanges = activityLogs.filter((l: any) =>
      l.action === "password_changed" || l.action === "password_reset" || l.entityType === "password"
    );

    res.json({ loginLogs, activityLogs, passwordChanges });
  });

  // ── Security routes (Super Admin only) ─────────────────────────────────────

  // Get / set maintenance mode
  app.get("/api/admin/maintenance-mode", (_req, res) => {
    res.json({ enabled: maintenanceMode, reopenAt: maintenanceReopenAt });
  });

  app.post("/api/admin/maintenance-mode", requireAuth, (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    maintenanceMode = !!req.body.enabled;
    if (!maintenanceMode) {
      maintenanceReopenAt = null;
    } else {
      maintenanceReopenAt = req.body.reopenAt ?? null;
    }
    res.json({ enabled: maintenanceMode, reopenAt: maintenanceReopenAt });
  });

  // ── SA broadcast notice ────────────────────────────────────────────────────
  // A soft, dismissible "updates in progress, expect instability" popup shown to
  // ALL users. Standard localized text (client-side); SA only toggles it on/off.
  // Persisted in app_settings so it survives the frequent redeploys.
  app.get("/api/broadcast-notice", async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await (pool as any).query(`SELECT value FROM app_settings WHERE key = 'broadcast_notice'`);
      const v = r.rows[0]?.value ? JSON.parse(r.rows[0].value) : { enabled: false, updatedAt: 0 };
      res.json(v);
    } catch { res.json({ enabled: false, updatedAt: 0 }); }
  });

  app.post("/api/admin/broadcast-notice", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const value = JSON.stringify({ enabled: !!req.body.enabled, updatedAt: Date.now() });
    const { pool } = await import("./db");
    await (pool as any).query(
      `INSERT INTO app_settings (key, value) VALUES ('broadcast_notice', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`, [value]);
    res.json(JSON.parse(value));
  });

  // ── What's new (#9) ────────────────────────────────────────────────────────
  // SA-authored release note shown once to every user. Type = feature/fix/update.
  app.get("/api/whats-new", async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await (pool as any).query(`SELECT value FROM app_settings WHERE key = 'whats_new'`);
      res.json(r.rows[0]?.value ? JSON.parse(r.rows[0].value) : null);
    } catch { res.json(null); }
  });

  app.post("/api/admin/whats-new", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const type = ["feature", "fix", "update"].includes(req.body.type) ? req.body.type : "update";
    const text = String(req.body.text ?? "").trim().slice(0, 2000);
    if (!text) return res.status(400).json({ message: "Text required" });
    const value = JSON.stringify({ id: Date.now(), type, text, updatedAt: Date.now() });
    const { pool } = await import("./db");
    await (pool as any).query(
      `INSERT INTO app_settings (key, value) VALUES ('whats_new', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`, [value]);
    res.json(JSON.parse(value));
  });

  // List all active sessions with user info
  app.get("/api/admin/active-sessions", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const { pool } = await import("./db");
    try {
      const result = await (pool as any).query(`
        SELECT sid,
               (sess::json -> 'passport' ->> 'user')::int AS user_id,
               sess::json ->> 'ipAddress' AS ip_address,
               sess::json ->> 'userAgent' AS user_agent,
               expire
        FROM user_sessions
        WHERE expire > NOW()
          AND sess::json -> 'passport' IS NOT NULL
          AND sess::json -> 'passport' ->> 'user' IS NOT NULL
        ORDER BY expire DESC
      `);

      const rows = result.rows;
      const userIds: number[] = [...new Set(rows.map((r: any) => r.user_id as number))];
      const userDetails: Record<number, any> = {};
      for (const uid of userIds) {
        const found = await storage.getUser(uid);
        if (found) userDetails[uid] = found;
      }

      // Last actual login per user (from the login history).
      const lastLogin = new Map<number, string>();
      if (userIds.length > 0) {
        const ll = await (pool as any).query(
          `SELECT user_id, MAX(login_at) AS last FROM login_logs WHERE user_id = ANY($1::int[]) AND action = 'login' GROUP BY user_id`,
          [userIds]
        ).catch(() => ({ rows: [] }));
        for (const r of ll.rows) lastLogin.set(r.user_id, r.last);
      }

      const sessions = rows.map((row: any) => {
        const usr = userDetails[row.user_id];
        return {
          sid: row.sid,
          userId: row.user_id,
          userName: usr?.name || "Unknown",
          email: usr?.email || "—",
          teamId: usr?.teamId ?? null,
          isAdmin: usr?.isAdmin ?? 0,
          ipAddress: row.ip_address || null,
          userAgent: row.user_agent || null,
          expiresAt: row.expire,
          lastLoginAt: lastLogin.get(row.user_id) ?? null,
          lastActivityAt: usr?.lastSeen ?? null,
        };
      });
      res.json(sessions);
    } catch (err: any) {
      console.error("Active sessions error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Emergency lockdown: terminate all sessions for users in a specific team
  app.post("/api/admin/emergency-lockdown/:teamId", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const teamId = parseInt(req.params.teamId);
    const { pool } = await import("./db");
    // Find all users in the team
    const userRes = await (pool as any).query(`SELECT id FROM users WHERE team_id = $1`, [teamId]);
    const teamUserIds: string[] = userRes.rows.map((r: any) => String(r.id));
    if (teamUserIds.length === 0) return res.json({ loggedOut: 0 });
    // Delete their sessions, but NOT the current SA's session
    const result = await (pool as any).query(
      `DELETE FROM user_sessions
       WHERE sess::jsonb -> 'passport' ->> 'user' = ANY($1::text[])
         AND sess::jsonb -> 'passport' ->> 'user' != $2`,
      [teamUserIds, String(u.id)]
    );
    res.json({ loggedOut: result.rowCount || 0 });
  });

  // SA: set plan directly
  app.patch("/api/admin/teams/:id/plan", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const teamId = parseInt(req.params.id);
    const { planName, customPrice, billingPeriod, nextBillingDate, maxUsers, maxGroups, maxTests, maxProducts, notes } = req.body;
    const { PLAN_FEATURE_PRESETS } = await import("@shared/schema");
    const { pool } = await import("./db");

    // Percent discount (0–100) — applied on top of whatever price model the
    // team uses (dynamic custom pricing or fixed plan price).
    if (req.body.discountPercent !== undefined) {
      const d = Math.min(100, Math.max(0, Number(req.body.discountPercent) || 0));
      await (pool as any).query(`UPDATE teams SET discount_percent = $1 WHERE id = $2`, [d, teamId]);
    }

    // Commercial terms for foreign teams: display currency, VAT exemption
    // (reverse charge), and the team's timezone — SA only, any plan type.
    if (req.body.currency !== undefined) {
      const cur = String(req.body.currency).toUpperCase();
      if (!["NOK", "EUR", "USD"].includes(cur)) return res.status(400).json({ message: "currency must be NOK, EUR or USD" });
      await (pool as any).query(`UPDATE teams SET currency = $1 WHERE id = $2`, [cur, teamId]);
    }
    if (req.body.vatExempt !== undefined) {
      await (pool as any).query(`UPDATE teams SET vat_exempt = $1 WHERE id = $2`, [req.body.vatExempt ? 1 : 0, teamId]);
    }
    if (req.body.timezone !== undefined) {
      const tz = String(req.body.timezone);
      try { new Date().toLocaleString("sv-SE", { timeZone: tz }); }
      catch { return res.status(400).json({ message: "Unknown timezone" }); }
      await (pool as any).query(`UPDATE teams SET timezone = $1 WHERE id = $2`, [tz, teamId]);
    }
    // Nation design pack: which nation the team represents + whether the
    // full visual identity (colors, flag ribbon) is switched on.
    if (req.body.nation !== undefined) {
      const nation = req.body.nation ? String(req.body.nation).toLowerCase().slice(0, 2) : null;
      await (pool as any).query(`UPDATE teams SET nation = $1 WHERE id = $2`, [nation, teamId]);
    }
    if (req.body.nationThemeEnabled !== undefined) {
      await (pool as any).query(`UPDATE teams SET nation_theme_enabled = $1 WHERE id = $2`, [req.body.nationThemeEnabled ? 1 : 0, teamId]);
    }

    // Fetch current team state for change log
    const currentResult = await (pool as any).query(`SELECT * FROM teams WHERE id = $1`, [teamId]);
    const currentTeam = currentResult.rows[0];

    // Custom plans: SA may set the feature composition directly — the price
    // follows dynamically from the current price list.
    if (req.body.features !== undefined && (planName === "custom" || (!planName && currentTeam?.plan_name === "custom"))) {
      const { sanitizeFeatureSelection } = await import("@shared/pricing");
      const feats = sanitizeFeatureSelection(req.body.features);
      await (pool as any).query(`UPDATE teams SET enabled_areas = $1 WHERE id = $2`, [JSON.stringify(feats), teamId]);
    }

    if (planName && planName !== "custom") {
      const preset = PLAN_FEATURE_PRESETS[planName];
      if (!preset) return res.status(400).json({ message: "Unknown plan" });
      await (pool as any).query(
        `UPDATE teams SET plan_name = $1, enabled_areas = $2,
          custom_price = COALESCE($3, custom_price),
          billing_period = COALESCE($4, billing_period),
          next_billing_date = COALESCE($5, next_billing_date),
          max_users = $6, max_groups = $7, max_tests = $8, max_products = $9
          ${notes !== undefined ? ", notes = $11" : ""}
         WHERE id = $10`,
        [planName, JSON.stringify([...preset.features]),
         customPrice ?? null, billingPeriod ?? null, nextBillingDate ?? null,
         maxUsers ?? null, maxGroups ?? null, maxTests ?? null, maxProducts ?? null,
         teamId, ...(notes !== undefined ? [notes] : [])]
      );
    } else {
      await (pool as any).query(
        `UPDATE teams SET plan_name = COALESCE($1, plan_name),
          custom_price = $2, billing_period = COALESCE($3, billing_period),
          next_billing_date = $4, max_users = $5, max_groups = $6,
          max_tests = $7, max_products = $8
          ${notes !== undefined ? ", notes = $10" : ""}
         WHERE id = $9`,
        [planName ?? null, customPrice ?? null, billingPeriod ?? null,
         nextBillingDate ?? null, maxUsers ?? null, maxGroups ?? null,
         maxTests ?? null, maxProducts ?? null, teamId, ...(notes !== undefined ? [notes] : [])]
      );
    }

    // Log plan change if plan or price changed
    if (currentTeam && (planName !== undefined || customPrice !== undefined)) {
      const changedAt = new Date().toISOString();
      const changedBy = u.name || u.email || null;
      await (pool as any).query(
        `INSERT INTO plan_change_log (team_id, team_name, changed_at, changed_by, old_plan, new_plan, old_price, new_price, billing_period, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          teamId,
          currentTeam.name,
          changedAt,
          changedBy,
          currentTeam.plan_name ?? null,
          planName ?? currentTeam.plan_name ?? null,
          currentTeam.custom_price ?? null,
          customPrice !== undefined ? customPrice : (currentTeam.custom_price ?? null),
          billingPeriod ?? currentTeam.billing_period ?? null,
          notes ?? null,
        ]
      );
    }

    const result = await (pool as any).query(`SELECT * FROM teams WHERE id = $1`, [teamId]);
    if (!result.rows[0]) return res.status(404).json({ message: "Team not found" });
    res.json(result.rows[0]);
  });

  // GET /api/admin/teams/:id/plan-history
  app.get("/api/admin/teams/:id/plan-history", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const teamId = parseInt(req.params.id);
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT * FROM plan_change_log WHERE team_id = $1 ORDER BY changed_at DESC`,
      [teamId]
    );
    res.json(result.rows);
  });

  // GET /api/admin/billing — all records, ordered by due date
  // ── Parent/child team management ─────────────────────────────────────────
  // SA: link/unlink a child team to a parent and choose the shared areas.
  app.patch("/api/admin/teams/:id/parent", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const teamId = parseInt(req.params.id);
    const parentTeamId = req.body.parentTeamId != null && req.body.parentTeamId !== "" ? parseInt(String(req.body.parentTeamId)) : null;
    if (parentTeamId === teamId) return res.status(400).json({ message: "A team cannot be its own parent" });
    if (parentTeamId != null) {
      const parent = await storage.getTeam(parentTeamId);
      if (!parent) return res.status(404).json({ message: "Parent team not found" });
      if ((parent as any).parentTeamId) return res.status(400).json({ message: "Nested child teams are not supported (one level only)" });
    }
    const allowedAreas = ["tests", "products", "kick", "weather", "grinding"];
    const sharedAreas = Array.isArray(req.body.sharedAreas)
      ? req.body.sharedAreas.filter((a: any) => allowedAreas.includes(a))
      : [];
    const { pool: pPar } = await import("./db");
    await (pPar as any).query(
      `UPDATE teams SET parent_team_id = $1, shared_areas = $2 WHERE id = $3`,
      [parentTeamId, parentTeamId != null ? JSON.stringify(sharedAreas) : null, teamId]
    );
    res.json({ ok: true, parentTeamId, sharedAreas: parentTeamId != null ? sharedAreas : [] });
  });

  // Child teams of the caller's ACTIVE team (drives the curation UI).
  app.get("/api/child-teams", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.json([]);
    res.json(await listChildTeams(getActiveTeamId(req)));
  });

  // Curation: what the parent hides from its child teams.
  app.get("/api/child-visibility", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const { pool: pCv } = await import("./db");
    const r = await (pCv as any).query(
      `SELECT id, entity_type AS "entityType", entity_id AS "entityId", created_at AS "createdAt", created_by_name AS "createdByName"
       FROM child_visibility_exclusions WHERE parent_team_id = $1`, [getActiveTeamId(req)]);
    res.json(r.rows);
  });
  app.post("/api/child-visibility", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const entityType = String(req.body.entityType ?? "");
    const entityId = parseInt(String(req.body.entityId ?? ""));
    if (!["test", "test_entry", "product"].includes(entityType) || !entityId) {
      return res.status(400).json({ message: "entityType (test|test_entry|product) and entityId required" });
    }
    const { pool: pCv } = await import("./db");
    await (pCv as any).query(
      `INSERT INTO child_visibility_exclusions (parent_team_id, entity_type, entity_id, created_at, created_by_name)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (SELECT 1 FROM child_visibility_exclusions WHERE parent_team_id = $1 AND entity_type = $2 AND entity_id = $3)`,
      [teamId, entityType, entityId, new Date().toISOString(), u.name]);
    res.json({ ok: true });
  });
  app.delete("/api/child-visibility", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const entityType = String(req.query.entityType ?? req.body?.entityType ?? "");
    const entityId = parseInt(String(req.query.entityId ?? req.body?.entityId ?? ""));
    const { pool: pCv } = await import("./db");
    await (pCv as any).query(
      `DELETE FROM child_visibility_exclusions WHERE parent_team_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [getActiveTeamId(req), entityType, entityId]);
    res.json({ ok: true });
  });

  // SA: emancipate a child team — it becomes fully independent. Optionally the
  // parent's shared (visible, curated) data is COPIED into the child first, so
  // they keep exactly what they could see.
  app.post("/api/admin/teams/:id/emancipate", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const teamId = parseInt(req.params.id);
    const team = await storage.getTeam(teamId);
    if (!team || !(team as any).parentTeamId) return res.status(400).json({ message: "Team has no parent" });
    const withCopy = req.body.withCopy === true;
    const share = await getParentShare(teamId);
    const { pool: pEm } = await import("./db");
    const copied: Record<string, number> = {};

    if (withCopy && share) {
      const excl = await getChildExclusions(share.parentTeamId);
      const colCache = new Map<string, string[]>();
      const colsOf = async (t: string) => {
        if (!colCache.has(t)) {
          const r = await (pEm as any).query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [t]);
          colCache.set(t, r.rows.map((x: any) => x.column_name));
        }
        return colCache.get(t)!;
      };
      const insertRow = async (table: string, row: any, overrides: Record<string, any>) => {
        const valid = await colsOf(table);
        const data: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) if (k !== "id" && valid.includes(k)) data[k] = v;
        Object.assign(data, overrides);
        const cols = Object.keys(data).filter((c) => /^[a-z0-9_]+$/i.test(c));
        const r = await (pEm as any).query(
          `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`,
          cols.map((c) => data[c]));
        copied[table] = (copied[table] ?? 0) + 1;
        return r.rows[0]?.id ?? null;
      };
      const productMap = new Map<number, number>();
      if (share.sharedAreas.includes("products")) {
        const pr = await (pEm as any).query(`SELECT * FROM products WHERE team_id = $1`, [share.parentTeamId]);
        for (const p of pr.rows) {
          if (excl.products.has(p.id)) continue;
          const nid = await insertRow("products", p, { team_id: teamId, group_scope: "" });
          if (nid != null) productMap.set(p.id, nid);
        }
      }
      if (share.sharedAreas.includes("tests")) {
        const tr = await (pEm as any).query(
          `SELECT * FROM tests WHERE team_id = $1 AND (test_ski_source IS NULL OR test_ski_source <> 'raceskis')`, [share.parentTeamId]);
        for (const t of tr.rows) {
          if (excl.tests.has(t.id)) continue;
          const ntid = await insertRow("tests", t, { team_id: teamId, group_scope: "", series_id: null, weather_id: null, athlete_id: null });
          if (ntid == null) continue;
          const er = await (pEm as any).query(`SELECT * FROM test_entries WHERE test_id = $1`, [t.id]);
          const visible = er.rows.filter((e: any) => !excl.entries.has(e.id) && !(e.product_id != null && excl.products.has(e.product_id)));
          const camel = visible.map((e: any) => ({
            ...e, productId: e.product_id, results: e.results,
            result0kmCmBehind: e.result_0km_cm_behind, rank0km: e.rank_0km,
            feelingRank: e.feeling_rank, kickRank: e.kick_rank,
          }));
          const recomputed = visible.length !== er.rows.length ? recomputeSharedEntries(camel) : camel;
          for (const e of recomputed) {
            await insertRow("test_entries", {
              ...Object.fromEntries(Object.entries(e).filter(([k]) => !["productId", "result0kmCmBehind", "rank0km", "feelingRank", "kickRank"].includes(k))),
              results: e.results,
              result_0km_cm_behind: e.result0kmCmBehind,
              rank_0km: e.rank0km,
              feeling_rank: e.feelingRank,
              kick_rank: e.kickRank,
              product_id: e.productId != null ? (productMap.get(e.productId) ?? null) : null,
              race_ski_id: null,
            }, { test_id: ntid });
          }
        }
      }
      if (share.sharedAreas.includes("kick")) {
        const skiMap = new Map<number, number>();
        const ks = await (pEm as any).query(`SELECT * FROM kick_skis WHERE team_id = $1 AND archived_at IS NULL`, [share.parentTeamId]);
        for (const s of ks.rows) {
          const nid = await insertRow("kick_skis", s, { team_id: teamId, group_scope: "" });
          if (nid != null) skiMap.set(s.id, nid);
        }
        const kt = await (pEm as any).query(`SELECT * FROM kick_tests WHERE team_id = $1`, [share.parentTeamId]);
        for (const t of kt.rows) {
          const ntid = await insertRow("kick_tests", t, { team_id: teamId, group_scope: "", weather_id: null });
          if (ntid == null) continue;
          const ke = await (pEm as any).query(`SELECT * FROM kick_test_entries WHERE kick_test_id = $1`, [t.id]);
          for (const e of ke.rows) {
            const mappedSki = skiMap.get(e.kick_ski_id);
            if (mappedSki == null) continue;
            await insertRow("kick_test_entries", e, { kick_test_id: ntid, kick_ski_id: mappedSki });
          }
        }
        const km = await (pEm as any).query(`SELECT * FROM kick_mixes WHERE team_id = $1`, [share.parentTeamId]);
        for (const m of km.rows) await insertRow("kick_mixes", m, { team_id: teamId, group_scope: "" });
      }
    }

    await (pEm as any).query(`UPDATE teams SET parent_team_id = NULL, shared_areas = NULL WHERE id = $1`, [teamId]);
    const now = new Date().toISOString();
    await storage.createActivityLog({
      userId: (u as any).id, userName: (u as any).name, action: "team_emancipated",
      entityType: "team", entityId: teamId,
      details: `Team made independent${withCopy ? ` — shared data copied (${Object.entries(copied).map(([t, n]) => `${t}:${n}`).join(", ") || "nothing"})` : " — no data copy"}`,
      createdAt: now, groupScope: "", teamId,
    } as any).catch(() => {});
    if (share) {
      await storage.createActivityLog({
        userId: (u as any).id, userName: (u as any).name, action: "team_emancipated",
        entityType: "team", entityId: teamId,
        details: `Child team «${team.name}» made independent — sharing ended`,
        createdAt: now, groupScope: "", teamId: share.parentTeamId,
      } as any).catch(() => {});
    }
    res.json({ ok: true, copied });
  });

  app.get("/api/admin/billing", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT * FROM billing_records ORDER BY due_date ASC, created_at DESC`
    );
    res.json(result.rows);
  });

  // POST /api/admin/billing — create a billing record
  app.post("/api/admin/billing", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const { teamId, teamName, amount, currency, description, periodStart, periodEnd, dueDate, notes, invoiced } = req.body;
    if (!teamId || !amount || !dueDate || !teamName) return res.status(400).json({ message: "teamId, teamName, amount, dueDate required" });
    const { pool } = await import("./db");
    const now = new Date().toISOString();
    const invoicedAt = invoiced ? now : null;
    const result = await (pool as any).query(
      `INSERT INTO billing_records (team_id, team_name, amount, currency, description, period_start, period_end, due_date, notes, created_at, invoiced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [teamId, teamName, amount, currency || "NOK", description || null, periodStart || null, periodEnd || null, dueDate, notes || null, now, invoicedAt]
    );
    res.json(result.rows[0]);
  });

  // PATCH /api/admin/billing/:id — mark invoiced or paid (or update notes)
  app.patch("/api/admin/billing/:id", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const id = parseInt(req.params.id);
    const { invoiced, paid, notes } = req.body;
    const { pool } = await import("./db");
    const now = new Date().toISOString();
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (invoiced === true)  { setClauses.push(`invoiced_at = $${idx++}`); values.push(now); }
    if (invoiced === false) { setClauses.push(`invoiced_at = $${idx++}`); values.push(null); }
    if (paid === true)      { setClauses.push(`paid_at = $${idx++}`);     values.push(now); }
    if (paid === false)     { setClauses.push(`paid_at = $${idx++}`);     values.push(null); }
    if (notes !== undefined){ setClauses.push(`notes = $${idx++}`);       values.push(notes); }
    if (!setClauses.length) return res.status(400).json({ message: "Nothing to update" });
    values.push(id);
    const result = await (pool as any).query(
      `UPDATE billing_records SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Not found" });
    res.json(result.rows[0]);
  });

  // DELETE /api/admin/billing/:id
  app.delete("/api/admin/billing/:id", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    await (pool as any).query(`DELETE FROM billing_records WHERE id = $1`, [id]);
    res.json({ ok: true });
  });

  // Team pause
  app.put("/api/admin/teams/:id/pause", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const teamId = parseInt(req.params.id);
    const paused = req.body.paused === true ? 1 : 0;
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `UPDATE teams SET is_paused = $1 WHERE id = $2 RETURNING *`,
      [paused, teamId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Team not found" });
    res.json(result.rows[0]);
  });

  // SA Overview
  app.get("/api/admin/overview", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const { pool } = await import("./db");
    const [teamsRes, recentTestsRes, recentLoginsRes, statsRes, activeSessionsRes] = await Promise.all([
      (pool as any).query(`
        SELECT t.id, t.name, t.is_paused,
          COUNT(DISTINCT u.id) AS user_count,
          COUNT(DISTINCT te.id) AS test_count,
          MAX(te.date) AS last_activity
        FROM teams t
        LEFT JOIN users u ON u.team_id = t.id
        LEFT JOIN tests te ON te.team_id = t.id
        GROUP BY t.id, t.name, t.is_paused
        ORDER BY t.name
      `),
      (pool as any).query(`
        SELECT te.id, t.name AS team_name, te.date, te.location, te.test_type,
          te.created_by_name
        FROM tests te
        LEFT JOIN teams t ON t.id = te.team_id
        ORDER BY te.id DESC
        LIMIT 20
      `),
      (pool as any).query(`
        SELECT ll.user_id, ll.name, t.name AS team_name, ll.login_at AS logged_in_at
        FROM login_logs ll
        LEFT JOIN users u ON u.id = ll.user_id
        LEFT JOIN teams t ON t.id = u.team_id
        ORDER BY ll.id DESC
        LIMIT 500
      `),
      (pool as any).query(`
        SELECT
          (SELECT COUNT(*) FROM teams) AS total_teams,
          (SELECT COUNT(*) FROM users) AS total_users,
          (SELECT COUNT(*) FROM tests) AS total_tests,
          (SELECT COUNT(*) FROM products) AS total_products
      `),
      (pool as any).query(`
        SELECT us.sid, us.sess, us.expire,
          u.id AS user_id,
          u.name AS name,
          t.name AS team_name
        FROM user_sessions us
        LEFT JOIN users u ON u.id = (us.sess::json->'passport'->>'user')::int
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE us.expire > NOW()
        ORDER BY us.expire DESC
      `),
    ]);
    const stats = statsRes.rows[0];
    res.json({
      teams: teamsRes.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        isPaused: r.is_paused === 1 || r.is_paused === true,
        userCount: parseInt(r.user_count) || 0,
        testCount: parseInt(r.test_count) || 0,
        lastActivity: r.last_activity || null,
      })),
      recentTests: recentTestsRes.rows.map((r: any) => ({
        id: r.id,
        teamName: r.team_name,
        date: r.date,
        location: r.location,
        testType: r.test_type,
        createdByName: r.created_by_name,
      })),
      recentLogins: recentLoginsRes.rows.map((r: any) => ({
        userId: r.user_id,
        name: r.name,
        teamName: r.team_name,
        loggedInAt: r.logged_in_at,
      })),
      activeSessions: activeSessionsRes.rows
        .filter((r: any) => r.user_id != null)
        .map((r: any) => ({
          userId: r.user_id,
          name: r.name || "Unknown",
          teamName: r.team_name || "—",
          lastActive: r.expire,
        })),
      stats: {
        totalTeams: parseInt(stats.total_teams) || 0,
        totalUsers: parseInt(stats.total_users) || 0,
        totalTests: parseInt(stats.total_tests) || 0,
        totalProducts: parseInt(stats.total_products) || 0,
      },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────

  // --- Athletes CRUD ---
  app.get("/api/athletes", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    // Archived athletes are hidden everywhere (new-test/dashboard pickers etc.)
    // unless the caller explicitly opts in (the Race skis archive view).
    const includeArchived = req.query.includeArchived === "1";
    let list = await storage.listAthletes(u.id, u.isScopeAdmin, teamId);
    if (req.query.includeFleet === "1") {
      try {
        const { pool: pgIF } = await import("./db");
        const fr = await (pgIF as any).query(`SELECT * FROM athletes WHERE team_id = $1 AND is_fleet = 1`, [teamId]);
        for (const row of fr.rows) {
          list.push({
            id: row.id, name: row.name, teamId: row.team_id, archived: row.archived,
            isFleet: 1, createdById: row.created_by_id, createdByName: row.created_by_name,
            createdAt: row.created_at,
          } as any);
        }
      } catch { /* additive */ }
    }
    if (!includeArchived) list = list.filter((a: any) => !a.archived);
    // Profile-only athletes live in Race fleets' "My athletes" — rosters and
    // pickers elsewhere don't see them unless they opt in.
    const profilesVisible = req.query.includeProfiles === "1" && (await teamHasFeature(teamId, "para_team"));
    if (!profilesVisible) list = list.filter((a: any) => (a as any).isProfileOnly !== 1);
    // Transferred athletes stay visible to the OLD team through the 14-day
    // grace window, flagged so the UI can badge them and offer revoke.
    if (teamId) {
      try {
        const { pool: pG } = await import("./db");
        const g = await (pG as any).query(
          `SELECT tr.athlete_id AS id, tr.grace_until AS "graceUntil", tr.id AS "transferId", tm.name AS "toTeamName"
           FROM athlete_transfers tr LEFT JOIN teams tm ON tm.id = tr.to_team_id
           WHERE tr.from_team_id = $1 AND tr.status = 'accepted' AND tr.grace_until > $2`,
          [teamId, new Date().toISOString()]);
        for (const row of g.rows) {
          const ath: any = await storage.getAthlete(row.id);
          if (!ath || (ath.archived && !includeArchived)) continue;
          if (!u.isScopeAdmin && ath.createdById !== u.id) {
            const acc = await (pG as any).query(`SELECT 1 FROM athlete_access WHERE athlete_id = $1 AND user_id = $2`, [row.id, u.id]);
            if (acc.rows.length === 0) continue;
          }
          list.push({ ...ath, transferGrace: true, transferGraceUntil: row.graceUntil, transferToTeam: row.toTeamName, transferId: row.transferId });
        }
        // Borrowed athletes: active loans TO this team.
        const lo = await (pG as any).query(
          `SELECT lo.athlete_id AS id, lo.expires_at AS "expiresAt", lo.id AS "loanId", lo.can_edit AS "canEdit", tm.name AS "ownerTeamName"
           FROM athlete_loans lo LEFT JOIN teams tm ON tm.id = lo.owner_team_id
           WHERE lo.to_team_id = $1 AND lo.status = 'active' AND (lo.expires_at IS NULL OR lo.expires_at > $2)`,
          [teamId, new Date().toISOString()]);
        for (const row of lo.rows) {
          if (list.some((a: any) => a.id === row.id)) continue;
          const ath: any = await storage.getAthlete(row.id);
          if (!ath || (ath.archived && !includeArchived)) continue;
          list.push({ ...ath, loan: true, loanUntil: row.expiresAt, loanFromTeam: row.ownerTeamName, loanId: row.loanId, loanCanEdit: row.canEdit });
        }
      } catch {}
    }
    // Athlete-access users see every athlete they've been granted (athlete_access),
    // not only their currently-active one — so all show on the Athlete skis page.
    if ((req.user as any).isAthleteAccess === 1) {
      const { pool } = await import("./db");
      const acc = await (pool as any).query(`SELECT athlete_id AS "athleteId" FROM athlete_access WHERE user_id = $1`, [u.id]);
      const ids = new Set<number>(acc.rows.map((r: any) => r.athleteId));
      const linkedId = (req.user as any).linkedAthleteId;
      if (linkedId) ids.add(linkedId);
      return res.json(list.filter((a: any) => ids.has(a.id)));
    }
    res.json(list);
  });

  app.post("/api/athletes", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const now = new Date().toISOString();
    // Main waxer defaults to the creating waxer; only a TA/SA may pick someone else.
    let mainWaxerId: number | null = u.id;
    let mainWaxerName: string | null = u.name;
    if (req.body.mainWaxerId !== undefined && u.isScopeAdmin) {
      const wid = req.body.mainWaxerId != null && req.body.mainWaxerId !== "" ? parseInt(String(req.body.mainWaxerId)) : null;
      if (wid != null && !isNaN(wid)) {
        const waxer = await storage.getUser(wid);
        if (waxer) { mainWaxerId = waxer.id; mainWaxerName = waxer.name; }
      }
    }
    const athlete = await storage.createAthlete({
      name: req.body.name,
      team: req.body.team || null,
      defaultSkiBrand: req.body.defaultSkiBrand || null,
      heightCm: req.body.heightCm || null,
      weightKg: req.body.weightKg || null,
      poleHeight: req.body.poleHeight || null,
      poleHeightSkate: req.body.poleHeightSkate || null,
      bindingPosition: req.body.bindingPosition || null,
      skiServicePreferences: req.body.skiServicePreferences || null,
      sportClass: req.body.sportClass || null,
      isProfileOnly: req.body.isProfileOnly && (await teamHasFeature(teamId, "para_team")) ? 1 : 0,
      mainWaxerId,
      mainWaxerName,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      teamId,
    });
    const accessUserIds: number[] = req.body.accessUserIds || [];
    const allAccessIds = [...new Set([...accessUserIds, u.id, ...(mainWaxerId != null ? [mainWaxerId] : [])])];
    await storage.setAthleteAccess(athlete.id, allAccessIds);
    res.json(athlete);
  });

  // ── Athlete transfer between teams ─────────────────────────────────────────
  // A TA sends the athlete to another team's TA by email. On accept the whole
  // profile moves (garage, regrinds, race usage, athlete ski tests) — product
  // references are stripped so HOW skis were prepared travels, WHAT they were
  // waxed with does not. The sending team keeps access for 14 days and its TA
  // can pull the athlete back during that window.
  const TRANSFER_GRACE_DAYS = 14;

  app.post("/api/athletes/:id/transfer", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Only a team admin can transfer an athlete" });
    const id = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const athlete = await storage.getAthlete(id);
    if (!athlete || (teamId && athlete.teamId !== teamId)) return res.status(404).json({ message: "Not found" });
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });
    const { pool: pT } = await import("./db");
    const target = await (pT as any).query(
      `SELECT id, name, email, team_id, is_team_admin FROM users WHERE LOWER(email) = $1 AND is_team_admin = 1 LIMIT 1`, [email]);
    if (target.rows.length === 0) return res.status(400).json({ message: "No team admin with that email" });
    const t = target.rows[0];
    if (t.team_id === teamId) return res.status(400).json({ message: "That admin is on your own team" });
    const dup = await (pT as any).query(
      `SELECT 1 FROM athlete_transfers WHERE athlete_id = $1 AND (status = 'pending' OR (status = 'accepted' AND grace_until > $2))`,
      [id, new Date().toISOString()]);
    if (dup.rows.length > 0) return res.status(400).json({ message: "A transfer is already in progress for this athlete" });
    const now = new Date().toISOString();
    const stripProducts = req.body?.stripProducts === false ? 0 : 1;
    const ins = await (pT as any).query(
      `INSERT INTO athlete_transfers (athlete_id, from_team_id, to_email, status, requested_by_id, requested_by_name, prev_main_waxer_id, prev_main_waxer_name, strip_products, created_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9) RETURNING id`,
      [id, teamId, email, u.id, u.name, athlete.mainWaxerId ?? null, athlete.mainWaxerName ?? null, stripProducts, now]);
    const fromTeam = teamId ? await storage.getTeam(teamId) : null;
    await (pT as any).query(
      `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at)
       VALUES ($1, $2, $3, $4, 0, $5)`,
      [t.id, u.name,
       `Utøveroverføring: ${athlete.name}`,
       `${u.name} (${fromTeam?.name ?? "annet lag"}) ønsker å overføre utøveren ${athlete.name} til laget ditt. Gå til Athlete Skis for å akseptere eller avslå. / ${u.name} (${fromTeam?.name ?? "another team"}) wants to transfer the athlete ${athlete.name} to your team. Open Athlete Skis to accept or decline.`,
       now]);
    try {
      const { sendAthleteTransferRequestEmail } = await import("./email");
      await sendAthleteTransferRequestEmail(t.email, { athleteName: athlete.name, fromTeam: fromTeam?.name ?? "", byName: u.name });
    } catch (e) { console.error("[transfer] email failed:", e); }
    res.json({ ok: true, transferId: ins.rows[0]?.id });
  });

  // SA override: move an athlete to any team instantly — no request, no
  // acceptance, no grace window. Any in-flight transfer is closed out.
  app.post("/api/athletes/:id/admin-move", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if ((req.user as any).isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const id = parseInt(req.params.id);
    const toTeamId = parseInt(String(req.body?.teamId));
    if (isNaN(toTeamId)) return res.status(400).json({ message: "teamId is required" });
    const athlete = await storage.getAthlete(id);
    if (!athlete) return res.status(404).json({ message: "Not found" });
    const toTeam = await storage.getTeam(toTeamId);
    if (!toTeam) return res.status(400).json({ message: "Team not found" });
    if (athlete.teamId === toTeamId) return res.status(400).json({ message: "Athlete is already on that team" });
    const fromTeamId = athlete.teamId;
    const { pool: pM } = await import("./db");
    await (pM as any).query(`UPDATE athletes SET team_id = $1 WHERE id = $2`, [toTeamId, id]);
    await (pM as any).query(`UPDATE race_skis SET team_id = $1 WHERE athlete_id = $2`, [toTeamId, id]);
    await (pM as any).query(`UPDATE ski_race_usages SET team_id = $1 WHERE athlete_id = $2`, [toTeamId, id]);
    await (pM as any).query(`UPDATE athlete_race_calendar SET team_id = $1 WHERE athlete_id = $2`, [toTeamId, id]).catch(() => {});
    // SA chooses whether product references travel (default: they do).
    if (req.body?.stripProducts === true) {
      await (pM as any).query(
        `UPDATE test_entries SET product_id = NULL, free_text_product = NULL
         WHERE test_id IN (SELECT id FROM tests WHERE athlete_id = $1)`, [id]).catch(() => {});
    }
    await (pM as any).query(`UPDATE tests SET team_id = $1 WHERE athlete_id = $2`, [toTeamId, id]);
    // Close out any in-flight transfer so no stale grace window lingers.
    const nowIso = new Date().toISOString();
    await (pM as any).query(`UPDATE athlete_transfers SET status = 'revoked' WHERE athlete_id = $1 AND status = 'pending'`, [id]);
    await (pM as any).query(`UPDATE athlete_transfers SET grace_until = $1 WHERE athlete_id = $2 AND status = 'accepted' AND grace_until > $1`, [nowIso, id]);
    await recordDeletion(req, "athlete_transfer", id, `SA moved athlete ${athlete.name} to team ${toTeam.name}`, { fromTeamId, toTeamId });
    res.json({ ok: true });
  });

  // ── Athlete loans: share an athlete with another team for a period ─────────
  // The athlete STAYS on the owning team; the borrowing team gets access until
  // the loan expires or the owner revokes it. Covers juniors riding for club
  // and region in the same season without a permanent move.
  app.post("/api/athletes/:id/loan", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Only a team admin can loan an athlete" });
    const id = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const athlete = await storage.getAthlete(id);
    if (!athlete || (teamId && athlete.teamId !== teamId)) return res.status(404).json({ message: "Not found" });
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });
    const expiresAt = req.body?.expiresAt ? String(req.body.expiresAt) : null;
    const canEdit = req.body?.canEdit === true ? 1 : 0;
    const { pool: pL } = await import("./db");
    const target = await (pL as any).query(
      `SELECT id, name, email, team_id FROM users WHERE LOWER(email) = $1 AND is_team_admin = 1 LIMIT 1`, [email]);
    if (target.rows.length === 0) return res.status(400).json({ message: "No team admin with that email" });
    const t = target.rows[0];
    if (t.team_id === teamId) return res.status(400).json({ message: "That admin is on your own team" });
    const nowIso = new Date().toISOString();
    const dup = await (pL as any).query(
      `SELECT 1 FROM athlete_loans WHERE athlete_id = $1 AND status IN ('pending','active') AND (expires_at IS NULL OR expires_at > $2)`,
      [id, nowIso]);
    if (dup.rows.length > 0) return res.status(400).json({ message: "A loan is already in progress for this athlete" });
    await (pL as any).query(
      `INSERT INTO athlete_loans (athlete_id, owner_team_id, to_email, status, can_edit, expires_at, requested_by_id, requested_by_name, created_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)`,
      [id, teamId, email, canEdit, expiresAt, u.id, u.name, nowIso]);
    const fromTeam = teamId ? await storage.getTeam(teamId) : null;
    await (pL as any).query(
      `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at) VALUES ($1, $2, $3, $4, 0, $5)`,
      [t.id, u.name, `Utlån av utøver: ${athlete.name}`,
       `${u.name} (${fromTeam?.name ?? ""}) tilbyr å låne ut utøveren ${athlete.name} til laget ditt${expiresAt ? ` frem til ${expiresAt}` : ""}. Gå til Athlete Skis for å akseptere eller avslå.`, nowIso]);
    try {
      const { sendAthleteLoanRequestEmail } = await import("./email");
      await sendAthleteLoanRequestEmail(t.email, { athleteName: athlete.name, fromTeam: fromTeam?.name ?? "", byName: u.name, expiresAt });
    } catch (e) { console.error("[loan] email failed:", e); }
    res.json({ ok: true });
  });

  app.get("/api/athlete-loans", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { pool: pL } = await import("./db");
    const nowIso = new Date().toISOString();
    const me = await storage.getUser(u.id);
    const incoming = u.isScopeAdmin && me?.email
      ? (await (pL as any).query(
          `SELECT lo.id, lo.athlete_id AS "athleteId", a.name AS "athleteName", lo.requested_by_name AS "requestedByName",
                  tm.name AS "fromTeamName", lo.expires_at AS "expiresAt", lo.can_edit AS "canEdit"
           FROM athlete_loans lo JOIN athletes a ON a.id = lo.athlete_id LEFT JOIN teams tm ON tm.id = lo.owner_team_id
           WHERE lo.status = 'pending' AND LOWER(lo.to_email) = LOWER($1)`, [me.email])).rows
      : [];
    const outgoing = teamId
      ? (await (pL as any).query(
          `SELECT lo.id, lo.athlete_id AS "athleteId", a.name AS "athleteName", lo.status, lo.expires_at AS "expiresAt", tm.name AS "toTeamName"
           FROM athlete_loans lo JOIN athletes a ON a.id = lo.athlete_id LEFT JOIN teams tm ON tm.id = lo.to_team_id
           WHERE lo.owner_team_id = $1 AND (lo.status = 'pending' OR (lo.status = 'active' AND (lo.expires_at IS NULL OR lo.expires_at > $2)))`,
          [teamId, nowIso])).rows
      : [];
    res.json({ incoming, outgoing });
  });

  app.post("/api/athlete-loans/:id/accept", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Only a team admin can accept" });
    const loId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const { pool: pL } = await import("./db");
    const me = await storage.getUser(u.id);
    const loRes = await (pL as any).query(`SELECT * FROM athlete_loans WHERE id = $1 AND status = 'pending'`, [loId]);
    const lo = loRes.rows[0];
    if (!lo || !me?.email || lo.to_email.toLowerCase() !== me.email.toLowerCase()) return res.status(404).json({ message: "Not found" });
    if (!teamId || teamId === lo.owner_team_id) return res.status(400).json({ message: "Switch to the receiving team first" });
    const nowIso = new Date().toISOString();
    await (pL as any).query(
      `UPDATE athlete_loans SET status = 'active', to_team_id = $1, accepted_by_id = $2, accepted_at = $3 WHERE id = $4`,
      [teamId, u.id, nowIso, loId]);
    const athlete = await storage.getAthlete(lo.athlete_id);
    const toTeam = await storage.getTeam(teamId);
    await (pL as any).query(
      `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at) VALUES ($1, $2, $3, $4, 0, $5)`,
      [lo.requested_by_id, u.name, `Utlån akseptert: ${athlete?.name ?? ""}`,
       `${u.name} (${toTeam?.name ?? ""}) har akseptert utlånet av ${athlete?.name ?? "utøveren"}${lo.expires_at ? ` frem til ${lo.expires_at}` : ""}.`, nowIso]);
    res.json({ ok: true });
  });

  app.post("/api/athlete-loans/:id/decline", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Only a team admin can decline" });
    const loId = parseInt(req.params.id);
    const { pool: pL } = await import("./db");
    const me = await storage.getUser(u.id);
    const loRes = await (pL as any).query(`SELECT * FROM athlete_loans WHERE id = $1 AND status = 'pending'`, [loId]);
    const lo = loRes.rows[0];
    if (!lo || !me?.email || lo.to_email.toLowerCase() !== me.email.toLowerCase()) return res.status(404).json({ message: "Not found" });
    await (pL as any).query(`UPDATE athlete_loans SET status = 'declined' WHERE id = $1`, [loId]);
    res.json({ ok: true });
  });

  app.post("/api/athlete-loans/:id/revoke", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Only a team admin can revoke" });
    const loId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const { pool: pL } = await import("./db");
    const loRes = await (pL as any).query(`SELECT * FROM athlete_loans WHERE id = $1`, [loId]);
    const lo = loRes.rows[0];
    if (!lo || lo.owner_team_id !== teamId) return res.status(404).json({ message: "Not found" });
    await (pL as any).query(`UPDATE athlete_loans SET status = 'revoked' WHERE id = $1`, [loId]);
    if (lo.accepted_by_id != null) {
      const athlete = await storage.getAthlete(lo.athlete_id);
      await (pL as any).query(
        `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at) VALUES ($1, $2, $3, $4, 0, $5)`,
        [lo.accepted_by_id, u.name, `Utlån avsluttet: ${athlete?.name ?? ""}`,
         `${u.name} har avsluttet utlånet av ${athlete?.name ?? "utøveren"}.`, new Date().toISOString()]);
    }
    res.json({ ok: true });
  });

  // ── Athlete timeline: career history across teams ───────────────────────────
  app.get("/api/athletes/:id/timeline", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const hasAccess = await storage.hasAthleteAccess(id, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const athlete = await storage.getAthlete(id);
    if (!athlete) return res.status(404).json({ message: "Not found" });
    const { pool: pTl } = await import("./db");
    const transfers = (await (pTl as any).query(
      `SELECT tr.status, tr.created_at AS "createdAt", tr.accepted_at AS "acceptedAt", tr.grace_until AS "graceUntil",
              tr.requested_by_name AS "requestedByName", f.name AS "fromTeamName", t.name AS "toTeamName"
       FROM athlete_transfers tr LEFT JOIN teams f ON f.id = tr.from_team_id LEFT JOIN teams t ON t.id = tr.to_team_id
       WHERE tr.athlete_id = $1 ORDER BY tr.created_at ASC`, [id])).rows;
    const loans = (await (pTl as any).query(
      `SELECT lo.status, lo.created_at AS "createdAt", lo.accepted_at AS "acceptedAt", lo.expires_at AS "expiresAt",
              lo.requested_by_name AS "requestedByName", f.name AS "fromTeamName", t.name AS "toTeamName"
       FROM athlete_loans lo LEFT JOIN teams f ON f.id = lo.owner_team_id LEFT JOIN teams t ON t.id = lo.to_team_id
       WHERE lo.athlete_id = $1 ORDER BY lo.created_at ASC`, [id])).rows;
    const currentTeam = athlete.teamId ? await storage.getTeam(athlete.teamId) : null;
    res.json({
      createdAt: athlete.createdAt, createdByName: athlete.createdByName,
      currentTeamName: currentTeam?.name ?? null,
      transfers, loans,
    });
  });

  // ── SA: merge duplicate athletes ───────────────────────────────────────────
  app.get("/api/admin/athletes-all", requireAuth, async (req, res) => {
    if ((req.user as any).isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const { pool: pA } = await import("./db");
    const rows = (await (pA as any).query(
      `SELECT a.id, a.name, a.team_id AS "teamId", tm.name AS "teamName", a.archived
       FROM athletes a LEFT JOIN teams tm ON tm.id = a.team_id ORDER BY a.name ASC`)).rows;
    res.json(rows);
  });

  app.post("/api/admin/athletes/merge", requireAuth, async (req, res) => {
    if ((req.user as any).isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const keepId = parseInt(String(req.body?.keepId));
    const mergeId = parseInt(String(req.body?.mergeId));
    if (isNaN(keepId) || isNaN(mergeId) || keepId === mergeId) return res.status(400).json({ message: "Pick two different athletes" });
    const keep = await storage.getAthlete(keepId);
    const merge = await storage.getAthlete(mergeId);
    if (!keep || !merge) return res.status(404).json({ message: "Athlete not found" });
    const { pool: pM } = await import("./db");
    // Repoint everything athlete-scoped onto the kept profile, in its team.
    await (pM as any).query(`UPDATE race_skis SET athlete_id = $1, team_id = $2 WHERE athlete_id = $3`, [keepId, keep.teamId, mergeId]);
    await (pM as any).query(`UPDATE ski_race_usages SET athlete_id = $1, team_id = $2 WHERE athlete_id = $3`, [keepId, keep.teamId, mergeId]);
    await (pM as any).query(`UPDATE tests SET athlete_id = $1, team_id = $2 WHERE athlete_id = $3`, [keepId, keep.teamId, mergeId]);
    await (pM as any).query(`UPDATE athlete_race_calendar SET athlete_id = $1, team_id = $2 WHERE athlete_id = $3`, [keepId, keep.teamId, mergeId]).catch(() => {});
    await (pM as any).query(`UPDATE race_prep_entries SET athlete_id = $1 WHERE athlete_id = $2`, [keepId, mergeId]).catch(() => {});
    await (pM as any).query(
      `INSERT INTO athlete_access (athlete_id, user_id, can_edit)
       SELECT $1, user_id, can_edit FROM athlete_access WHERE athlete_id = $2
       ON CONFLICT DO NOTHING`, [keepId, mergeId]).catch(() => {});
    await (pM as any).query(`DELETE FROM athlete_access WHERE athlete_id = $1`, [mergeId]).catch(() => {});
    await (pM as any).query(`DELETE FROM feedback_links WHERE athlete_id = $1`, [mergeId]).catch(() => {});
    await (pM as any).query(`UPDATE athlete_transfers SET athlete_id = $1 WHERE athlete_id = $2`, [keepId, mergeId]).catch(() => {});
    await (pM as any).query(`UPDATE athlete_loans SET athlete_id = $1 WHERE athlete_id = $2`, [keepId, mergeId]).catch(() => {});
    await (pM as any).query(`DELETE FROM athletes WHERE id = $1`, [mergeId]);
    await recordDeletion(req, "athlete_merge", keepId, `SA merged athlete "${merge.name}" (#${mergeId}) into "${keep.name}" (#${keepId})`, { keep, merged: merge });
    res.json({ ok: true });
  });

  // ── Team join requests: invite a waxer from another team, THEY consent ─────
  app.post("/api/team/invite-user", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    if (!teamId) return res.status(400).json({ message: "No active team" });
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });
    const target = await storage.getUserByEmail(email);
    if (!target) return res.status(404).json({ message: "User does not exist" });
    if ((target as any).isAdmin === 1) return res.status(400).json({ message: "Super Admins already have access to every team" });
    if (target.teamId === teamId) return res.status(400).json({ message: "User is already on this team" });
    const { pool: pJ } = await import("./db");
    const member = await (pJ as any).query(`SELECT 1 FROM user_teams WHERE user_id = $1 AND team_id = $2`, [target.id, teamId]);
    if (member.rows.length > 0) return res.status(400).json({ message: "User is already a member of this team" });
    const dup = await (pJ as any).query(`SELECT 1 FROM team_join_requests WHERE user_id = $1 AND team_id = $2 AND status = 'pending'`, [target.id, teamId]);
    if (dup.rows.length > 0) return res.status(400).json({ message: "An invitation is already pending" });
    const nowIso = new Date().toISOString();
    await (pJ as any).query(
      `INSERT INTO team_join_requests (user_id, team_id, status, requested_by_id, requested_by_name, created_at)
       VALUES ($1, $2, 'pending', $3, $4, $5)`, [target.id, teamId, u.id, u.name, nowIso]);
    const team = await storage.getTeam(teamId);
    await (pJ as any).query(
      `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at) VALUES ($1, $2, $3, $4, 0, $5)`,
      [target.id, u.name, `Invitasjon til laget ${team?.name ?? ""}`,
       `${u.name} inviterer deg til å bli med i laget ${team?.name ?? ""} i Glidr. Du finner forespørselen på dashbordet ditt — du beholder tilgangen til laget du er på i dag.`, nowIso]);
    try {
      const { sendTeamJoinRequestEmail } = await import("./email");
      await sendTeamJoinRequestEmail(target.email, { teamName: team?.name ?? "", byName: u.name });
    } catch (e) { console.error("[join-request] email failed:", e); }
    res.json({ ok: true });
  });

  app.get("/api/team-join-requests", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { pool: pJ } = await import("./db");
    const incoming = (await (pJ as any).query(
      `SELECT r.id, r.requested_by_name AS "requestedByName", r.created_at AS "createdAt", tm.name AS "teamName"
       FROM team_join_requests r LEFT JOIN teams tm ON tm.id = r.team_id
       WHERE r.user_id = $1 AND r.status = 'pending'`, [u.id])).rows;
    const outgoing = (canManageTeam(req) && teamId)
      ? (await (pJ as any).query(
          `SELECT r.id, r.status, r.created_at AS "createdAt", us.name AS "userName", us.email AS "userEmail"
           FROM team_join_requests r JOIN users us ON us.id = r.user_id
           WHERE r.team_id = $1 AND r.status = 'pending'`, [teamId])).rows
      : [];
    res.json({ incoming, outgoing });
  });

  app.post("/api/team-join-requests/:id/accept", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const rId = parseInt(req.params.id);
    const { pool: pJ } = await import("./db");
    const rRes = await (pJ as any).query(`SELECT * FROM team_join_requests WHERE id = $1 AND status = 'pending' AND user_id = $2`, [rId, u.id]);
    const r = rRes.rows[0];
    if (!r) return res.status(404).json({ message: "Not found" });
    await storage.addUserToTeam(u.id, r.team_id);
    let perms: Record<string, string> = Object.fromEntries(PERMISSION_AREAS.map((a) => [a, "edit"]));
    perms = await enforceTeamAreas(perms, r.team_id);
    await (pJ as any).query(
      `INSERT INTO user_team_permissions (user_id, team_id, permissions, group_scope, is_team_admin)
       VALUES ($1, $2, $3, '', 0)
       ON CONFLICT ON CONSTRAINT utp_user_team_unique DO UPDATE SET permissions = $3`,
      [u.id, r.team_id, JSON.stringify(perms)]);
    await (pJ as any).query(`UPDATE team_join_requests SET status = 'accepted' WHERE id = $1`, [rId]);
    const team = await storage.getTeam(r.team_id);
    await (pJ as any).query(
      `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at) VALUES ($1, $2, $3, $4, 0, $5)`,
      [r.requested_by_id, u.name, `Invitasjon akseptert`,
       `${u.name} har takket ja og er nå medlem av ${team?.name ?? "laget"}.`, new Date().toISOString()]);
    res.json({ ok: true });
  });

  app.post("/api/team-join-requests/:id/decline", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const rId = parseInt(req.params.id);
    const { pool: pJ } = await import("./db");
    const rRes = await (pJ as any).query(`SELECT * FROM team_join_requests WHERE id = $1 AND status = 'pending' AND user_id = $2`, [rId, u.id]);
    if (!rRes.rows[0]) return res.status(404).json({ message: "Not found" });
    await (pJ as any).query(`UPDATE team_join_requests SET status = 'declined' WHERE id = $1`, [rId]);
    res.json({ ok: true });
  });

  app.post("/api/team-join-requests/:id/cancel", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const rId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const { pool: pJ } = await import("./db");
    const rRes = await (pJ as any).query(`SELECT * FROM team_join_requests WHERE id = $1 AND status = 'pending' AND team_id = $2`, [rId, teamId]);
    if (!rRes.rows[0]) return res.status(404).json({ message: "Not found" });
    await (pJ as any).query(`UPDATE team_join_requests SET status = 'cancelled' WHERE id = $1`, [rId]);
    res.json({ ok: true });
  });

  app.get("/api/athlete-transfers", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { pool: pT } = await import("./db");
    const nowIso = new Date().toISOString();
    const me = await storage.getUser(u.id);
    const incoming = u.isScopeAdmin && me?.email
      ? (await (pT as any).query(
          `SELECT tr.id, tr.athlete_id AS "athleteId", a.name AS "athleteName", tr.requested_by_name AS "requestedByName",
                  tm.name AS "fromTeamName", tr.created_at AS "createdAt"
           FROM athlete_transfers tr
           JOIN athletes a ON a.id = tr.athlete_id
           LEFT JOIN teams tm ON tm.id = tr.from_team_id
           WHERE tr.status = 'pending' AND LOWER(tr.to_email) = LOWER($1)`, [me.email])).rows
      : [];
    const outgoing = teamId
      ? (await (pT as any).query(
          `SELECT tr.id, tr.athlete_id AS "athleteId", a.name AS "athleteName", tr.status, tr.to_email AS "toEmail",
                  tr.grace_until AS "graceUntil", tm.name AS "toTeamName"
           FROM athlete_transfers tr
           JOIN athletes a ON a.id = tr.athlete_id
           LEFT JOIN teams tm ON tm.id = tr.to_team_id
           WHERE tr.from_team_id = $1 AND (tr.status = 'pending' OR (tr.status = 'accepted' AND tr.grace_until > $2))`,
          [teamId, nowIso])).rows
      : [];
    res.json({ incoming, outgoing });
  });

  app.post("/api/athlete-transfers/:id/accept", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Only a team admin can accept" });
    const trId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const { pool: pT } = await import("./db");
    const me = await storage.getUser(u.id);
    const trRes = await (pT as any).query(`SELECT * FROM athlete_transfers WHERE id = $1 AND status = 'pending'`, [trId]);
    const tr = trRes.rows[0];
    if (!tr || !me?.email || tr.to_email.toLowerCase() !== me.email.toLowerCase()) return res.status(404).json({ message: "Not found" });
    if (!teamId || teamId === tr.from_team_id) return res.status(400).json({ message: "Switch to the receiving team first" });
    const athlete = await storage.getAthlete(tr.athlete_id);
    if (!athlete) return res.status(404).json({ message: "Athlete no longer exists" });
    const now = new Date();
    const nowIso = now.toISOString();
    const graceUntil = new Date(now.getTime() + TRANSFER_GRACE_DAYS * 24 * 3600 * 1000).toISOString();
    // Move the profile and everything athlete-scoped to the new team.
    await (pT as any).query(`UPDATE athletes SET team_id = $1, main_waxer_id = $2, main_waxer_name = $3 WHERE id = $4`,
      [teamId, u.id, u.name, tr.athlete_id]);
    await (pT as any).query(`UPDATE race_skis SET team_id = $1 WHERE athlete_id = $2`, [teamId, tr.athlete_id]);
    await (pT as any).query(`UPDATE ski_race_usages SET team_id = $1 WHERE athlete_id = $2`, [teamId, tr.athlete_id]);
    await (pT as any).query(`UPDATE athlete_race_calendar SET team_id = $1 WHERE athlete_id = $2`, [teamId, tr.athlete_id]).catch(() => {});
    // Athlete ski tests follow. The sender chose whether WHAT they were waxed
    // with travels: when stripping, product references go — application/method
    // and results always stay.
    if (tr.strip_products !== 0) {
      await (pT as any).query(
        `UPDATE test_entries SET product_id = NULL, free_text_product = NULL
         WHERE test_id IN (SELECT id FROM tests WHERE athlete_id = $1 AND team_id = $2)`,
        [tr.athlete_id, tr.from_team_id]).catch(() => {});
    }
    await (pT as any).query(`UPDATE tests SET team_id = $1 WHERE athlete_id = $2 AND team_id = $3`,
      [teamId, tr.athlete_id, tr.from_team_id]);
    // New TA gets main-waxer access; the old team's access rows stay for the
    // grace window (the team gate cuts them off automatically after it ends).
    await (pT as any).query(
      `INSERT INTO athlete_access (athlete_id, user_id, can_edit)
       SELECT $1, $2, 1 WHERE NOT EXISTS (SELECT 1 FROM athlete_access WHERE athlete_id = $1 AND user_id = $2)`,
      [tr.athlete_id, u.id]);
    await (pT as any).query(
      `UPDATE athlete_transfers SET status = 'accepted', to_team_id = $1, accepted_by_id = $2, accepted_at = $3, grace_until = $4 WHERE id = $5`,
      [teamId, u.id, nowIso, graceUntil, trId]);
    const toTeam = await storage.getTeam(teamId);
    await (pT as any).query(
      `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at)
       VALUES ($1, $2, $3, $4, 0, $5)`,
      [tr.requested_by_id, u.name,
       `Utøveroverføring akseptert: ${athlete.name}`,
       `${u.name} (${toTeam?.name ?? ""}) har akseptert overføringen av ${athlete.name}. Laget ditt har tilgang i ${TRANSFER_GRACE_DAYS} dager til, og du kan angre overføringen i samme periode fra Athlete Skis.`,
       nowIso]);
    await recordDeletion(req, "athlete_transfer", tr.athlete_id, `Athlete transferred in: ${athlete.name}`, { transferId: trId, fromTeamId: tr.from_team_id, toTeamId: teamId });
    res.json({ ok: true });
  });

  app.post("/api/athlete-transfers/:id/decline", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Only a team admin can decline" });
    const trId = parseInt(req.params.id);
    const { pool: pT } = await import("./db");
    const me = await storage.getUser(u.id);
    const trRes = await (pT as any).query(`SELECT * FROM athlete_transfers WHERE id = $1 AND status = 'pending'`, [trId]);
    const tr = trRes.rows[0];
    if (!tr || !me?.email || tr.to_email.toLowerCase() !== me.email.toLowerCase()) return res.status(404).json({ message: "Not found" });
    await (pT as any).query(`UPDATE athlete_transfers SET status = 'declined' WHERE id = $1`, [trId]);
    const athlete = await storage.getAthlete(tr.athlete_id);
    await (pT as any).query(
      `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at)
       VALUES ($1, $2, $3, $4, 0, $5)`,
      [tr.requested_by_id, u.name, `Utøveroverføring avslått: ${athlete?.name ?? ""}`,
       `${u.name} har avslått overføringen av ${athlete?.name ?? "utøveren"}.`, new Date().toISOString()]);
    res.json({ ok: true });
  });

  app.post("/api/athlete-transfers/:id/revoke", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Only a team admin can revoke" });
    const trId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const { pool: pT } = await import("./db");
    const trRes = await (pT as any).query(`SELECT * FROM athlete_transfers WHERE id = $1`, [trId]);
    const tr = trRes.rows[0];
    if (!tr || tr.from_team_id !== teamId) return res.status(404).json({ message: "Not found" });
    if (tr.status === 'pending') {
      await (pT as any).query(`UPDATE athlete_transfers SET status = 'revoked' WHERE id = $1`, [trId]);
      return res.json({ ok: true });
    }
    if (tr.status !== 'accepted' || !tr.grace_until || tr.grace_until <= new Date().toISOString()) {
      return res.status(400).json({ message: "The 14-day window has ended — the athlete now belongs to the new team" });
    }
    // Pull the athlete back: reverse the move.
    await (pT as any).query(`UPDATE athletes SET team_id = $1, main_waxer_id = $2, main_waxer_name = $3 WHERE id = $4`,
      [tr.from_team_id, tr.prev_main_waxer_id ?? null, tr.prev_main_waxer_name ?? null, tr.athlete_id]);
    await (pT as any).query(`UPDATE race_skis SET team_id = $1 WHERE athlete_id = $2`, [tr.from_team_id, tr.athlete_id]);
    await (pT as any).query(`UPDATE ski_race_usages SET team_id = $1 WHERE athlete_id = $2`, [tr.from_team_id, tr.athlete_id]);
    await (pT as any).query(`UPDATE athlete_race_calendar SET team_id = $1 WHERE athlete_id = $2`, [tr.from_team_id, tr.athlete_id]).catch(() => {});
    await (pT as any).query(`UPDATE tests SET team_id = $1 WHERE athlete_id = $2 AND team_id = $3`,
      [tr.from_team_id, tr.athlete_id, tr.to_team_id]);
    if (tr.accepted_by_id != null) {
      await (pT as any).query(`DELETE FROM athlete_access WHERE athlete_id = $1 AND user_id = $2`, [tr.athlete_id, tr.accepted_by_id]);
    }
    await (pT as any).query(`UPDATE athlete_transfers SET status = 'revoked' WHERE id = $1`, [trId]);
    const athlete = await storage.getAthlete(tr.athlete_id);
    if (tr.accepted_by_id != null) {
      await (pT as any).query(
        `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at)
         VALUES ($1, $2, $3, $4, 0, $5)`,
        [tr.accepted_by_id, u.name, `Utøveroverføring trukket tilbake: ${athlete?.name ?? ""}`,
         `${u.name} har trukket tilbake overføringen av ${athlete?.name ?? "utøveren"}. Utøveren er tilbake hos avsenderlaget.`, new Date().toISOString()]);
    }
    await recordDeletion(req, "athlete_transfer", tr.athlete_id, `Athlete transfer revoked: ${athlete?.name ?? tr.athlete_id}`, { transferId: trId });
    res.json({ ok: true });
  });

  app.put("/api/athletes/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const hasAccess = await storage.hasAthleteAccess(id, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.team !== undefined) data.team = req.body.team;
    if (req.body.defaultSkiBrand !== undefined) data.defaultSkiBrand = req.body.defaultSkiBrand;
    if (req.body.heightCm !== undefined) data.heightCm = req.body.heightCm || null;
    if (req.body.weightKg !== undefined) data.weightKg = req.body.weightKg || null;
    if (req.body.poleHeight !== undefined) data.poleHeight = req.body.poleHeight || null;
    if (req.body.poleHeightSkate !== undefined) data.poleHeightSkate = req.body.poleHeightSkate || null;
    if (req.body.bindingPosition !== undefined) data.bindingPosition = req.body.bindingPosition || null;
    if (req.body.skiServicePreferences !== undefined) data.skiServicePreferences = req.body.skiServicePreferences || null;
    if (req.body.sportClass !== undefined) data.sportClass = req.body.sportClass || null;
    if (req.body.archived !== undefined) data.archived = req.body.archived ? 1 : 0;
    // Profile-only can be toggled from My athletes (para teams) — also the
    // repair path for athletes created before the flag existed.
    if (req.body.isProfileOnly !== undefined && (await teamHasFeature(getActiveTeamId(req), "para_team"))) {
      data.isProfileOnly = req.body.isProfileOnly ? 1 : 0;
    }
    // Main waxer: only Team Admins / Super Admins may reassign it. Name is
    // resolved server-side so the client can't write an arbitrary label.
    if (req.body.mainWaxerId !== undefined) {
      if (!u.isScopeAdmin) return res.status(403).json({ message: "Only a team admin can change the main waxer" });
      const wid = req.body.mainWaxerId != null && req.body.mainWaxerId !== "" ? parseInt(String(req.body.mainWaxerId)) : null;
      if (wid == null || isNaN(wid)) {
        // "Cleared" means back to the default rule: the creator is the main waxer.
        const ath = await storage.getAthlete(id);
        data.mainWaxerId = ath?.createdById ?? null;
        data.mainWaxerName = ath?.createdByName ?? null;
      } else {
        const waxer = await storage.getUser(wid);
        if (!waxer) return res.status(400).json({ message: "Waxer not found" });
        data.mainWaxerId = waxer.id;
        data.mainWaxerName = waxer.name;
      }
    }
    const before = await storage.getAthlete(id);
    const updated = await storage.updateAthlete(id, data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    // On a main-waxer handover: the OLD waxer keeps regular shared access so
    // they can still see the athlete's data, and the NEW waxer is granted
    // access so they can work with the athlete right away.
    if (data.mainWaxerId !== undefined && before && before.mainWaxerId !== updated.mainWaxerId) {
      const { pool: pAcc } = await import("./db");
      // Old waxer: regular shared access (view of the athlete's data).
      if (before.mainWaxerId != null) {
        await (pAcc as any).query(
          `INSERT INTO athlete_access (athlete_id, user_id)
           SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM athlete_access WHERE athlete_id = $1 AND user_id = $2)`,
          [id, before.mainWaxerId]
        );
      }
      // New waxer: full main-waxer capabilities — access WITH edit rights.
      if (updated.mainWaxerId != null) {
        await (pAcc as any).query(
          `INSERT INTO athlete_access (athlete_id, user_id, can_edit)
           SELECT $1, $2, 1 WHERE NOT EXISTS (SELECT 1 FROM athlete_access WHERE athlete_id = $1 AND user_id = $2)`,
          [id, updated.mainWaxerId]
        );
        await (pAcc as any).query(
          `UPDATE athlete_access SET can_edit = 1 WHERE athlete_id = $1 AND user_id = $2`,
          [id, updated.mainWaxerId]
        );
      }
    }
    await recordChange(req, "athlete", id, `Athlete edited: ${updated.name}`, before, updated);
    res.json(updated);
  });

  // Archive / restore an athlete (kept with all skis & tests, hidden from the
  // default list). Any user with edit access to the athlete may archive it.
  app.post("/api/athletes/:id/archive", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const hasAccess = await storage.hasAthleteAccess(id, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const archived = req.body.archived ? 1 : 0;
    const updated = await storage.updateAthlete(id, { archived } as any);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true, archived: archived === 1 });
  });

  app.delete("/api/athletes/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const athlete = await storage.getAthlete(id);
    if (!athlete) return res.status(404).json({ message: "Not found" });
    // Team boundary first: deleting never crosses tenants, no matter the role
    // or who once created the record.
    if (!u.isAdmin && (athlete as any).teamId !== getActiveTeamId(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!u.isScopeAdmin && athlete.createdById !== u.id) {
      return res.status(403).json({ message: "Only admin or creator can delete" });
    }
    // Snapshot the athlete AND its skis (both cascade-deleted) before removal.
    const skis = await storage.listRaceSkis(id).catch(() => []);
    await storage.deleteAthlete(id);
    await recordDeletion(req, "athlete", id, `Athlete deleted: ${athlete.name}`, { athlete, skis });
    res.json({ ok: true });
  });

  app.get("/api/athletes/:id/access", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const hasAccess = await storage.hasAthleteAccess(id, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const accessList = await storage.listAthleteAccess(id);
    res.json(accessList);
  });

  app.put("/api/athletes/:id/access", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const athlete = await storage.getAthlete(id);
    if (!athlete) return res.status(404).json({ message: "Not found" });
    // Team boundary first — TA rights never cross teams.
    if (!u.isAdmin && (athlete as any).teamId !== getActiveTeamId(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!u.isScopeAdmin && athlete.createdById !== u.id) {
      return res.status(403).json({ message: "Only admin or creator can manage access" });
    }
    const userIds = Array.isArray(req.body.userIds)
      ? req.body.userIds.filter((id: any) => typeof id === "number" && !isNaN(id))
      : [];
    await storage.setAthleteAccess(id, userIds);
    res.json({ ok: true });
  });

  // --- Race Skis CRUD ---
  app.get("/api/race-skis/all", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const includeArchived = req.query.includeArchived === "true";
    if (includeArchived) {
      const athleteList = await storage.listAthletes(u.id, u.isScopeAdmin, getActiveTeamId(req));
      if (athleteList.length === 0) return res.json([]);
      const all: any[] = [];
      for (const ath of athleteList) {
        const skis = await storage.listAllRaceSkisIncludingArchived(ath.id);
        all.push(...skis);
      }
      return res.json(all);
    }
    const list = await storage.listAllRaceSkisForUser(u.id, u.isScopeAdmin, getActiveTeamId(req));
    // Team fleet skis (no athlete) are testable by anyone with raceskis
    // access — a fleet-group test picks one pair from each group.
    try {
      const teamId = getActiveTeamId(req);
      const { pool: pgF } = await import("./db");
      const fl = await (pgF as any).query(
        `SELECT rs.id, rs.ski_id AS "skiId", rs.serial_number AS "serialNumber", rs.brand, rs.discipline, rs.grind,
                rs.fleet_group AS "fleetGroup", rs.athlete_id AS "athleteId", 1 AS "isFleet"
         FROM race_skis rs JOIN athletes a ON a.id = rs.athlete_id AND a.is_fleet = 1
         WHERE a.team_id = $1 AND rs.archived_at IS NULL`, [teamId]);
      const have = new Set((list as any[]).map((x: any) => x.id));
      for (const row of fl.rows) if (!have.has(row.id)) (list as any[]).push(row);
    } catch { /* fleet skis are additive */ }
    res.json(list);
  });

  app.get("/api/athletes/:athleteId/skis", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.athleteId);
    const hasAccess = await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const includeArchived = req.query.includeArchived === "true";
    const list = includeArchived
      ? await storage.listAllRaceSkisIncludingArchived(athleteId)
      : await storage.listRaceSkis(athleteId);
    // #24: attach how many times each pair has been raced (race-use + race prep).
    try {
      const { pool } = await import("./db");
      const ownerAth = await storage.getAthlete(athleteId);
      const isFleetAth = (ownerAth as any)?.isFleet === 1;
      const [usageRes, testRes, prepRes] = await Promise.all([
        (pool as any).query(`SELECT ski_id, COUNT(*)::int AS c FROM ski_race_usages WHERE athlete_id = $1 GROUP BY ski_id`, [athleteId]),
        // How many tests each pair has been in — powers the Show tests button.
        (pool as any).query(
          `SELECT te.race_ski_id AS ski_id, COUNT(DISTINCT te.test_id)::int AS c
           FROM test_entries te JOIN race_skis rs ON rs.id = te.race_ski_id
           WHERE rs.athlete_id = $1 GROUP BY te.race_ski_id`, [athleteId]),
        (pool as any).query(
          `SELECT rpe.ski_id, rpe.ski_id_classic, rpe.ski_id_skating,
                  rpe.athlete_id, rpe.borrowed_athlete_id, rpe.borrowed_athlete_id_classic, rpe.borrowed_athlete_id_skating
           FROM race_prep_entries rpe JOIN race_preps rp ON rp.id = rpe.race_prep_id
           WHERE rp.team_id = $2 AND ($3 OR rpe.athlete_id = $1 OR rpe.borrowed_athlete_id = $1
                  OR rpe.borrowed_athlete_id_classic = $1 OR rpe.borrowed_athlete_id_skating = $1)`,
          [athleteId, getActiveTeamId(req), isFleetAth]),
      ]);
      const usageBySkiId = new Map<number, number>(usageRes.rows.map((r: any) => [r.ski_id, r.c]));
      // A slot's label counts for this garage when this athlete owns the pair:
      // it is their own entry, they lent it out (borrowed_*), or the garage is
      // the team fleet (fleet labels are unique, so match by label alone).
      const prepLabels: string[] = [];
      for (const r of prepRes.rows) {
        const singleOwner = r.borrowed_athlete_id ?? r.athlete_id;
        const classicOwner = r.borrowed_athlete_id_classic ?? r.borrowed_athlete_id ?? r.athlete_id;
        const skatingOwner = r.borrowed_athlete_id_skating ?? r.athlete_id;
        if (r.ski_id && (isFleetAth || singleOwner === athleteId)) prepLabels.push(String(r.ski_id).trim().toLowerCase());
        if (r.ski_id_classic && (isFleetAth || classicOwner === athleteId)) prepLabels.push(String(r.ski_id_classic).trim().toLowerCase());
        if (r.ski_id_skating && (isFleetAth || skatingOwner === athleteId)) prepLabels.push(String(r.ski_id_skating).trim().toLowerCase());
      }
      const prepCount = (ski: any) => {
        const keys = [ski.skiId, ski.serialNumber].filter(Boolean).map((s: string) => String(s).trim().toLowerCase());
        return prepLabels.filter((l: string) => keys.includes(l)).length;
      };
      const testsBySkiId = new Map<number, number>(testRes.rows.map((r: any) => [r.ski_id, r.c]));
      const withCounts = list.map((s: any) => ({ ...s, racedCount: (usageBySkiId.get(s.id) || 0) + prepCount(s), testCount: testsBySkiId.get(s.id) || 0 }));
      return res.json(withCounts);
    } catch {
      return res.json(list);
    }
  });

  app.post("/api/athletes/:athleteId/skis", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.athleteId);
    const hasAccess = await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const now = new Date().toISOString();
    const ski = await storage.createRaceSki({
      athleteId,
      teamId: getActiveTeamId(req) || null,
      serialNumber: req.body.serialNumber || null,
      skiId: req.body.skiId,
      brand: req.body.brand || null,
      discipline: req.body.discipline,
      construction: req.body.construction || null,
      mold: req.body.mold || null,
      base: req.body.base || null,
      grind: req.body.grind || null,
      heights: req.body.heights || null,
      year: req.body.year || null,
      length: req.body.length || null,
      typeOfSki: req.body.typeOfSki || null,
      whereReceived: req.body.whereReceived || null,
      notes: req.body.notes || null,
      isTrainingSki: req.body.isTrainingSki ? 1 : 0,
      isSitski: req.body.isSitski ? 1 : 0,
      fleetGroup: (req.body.fleetGroup ? String(req.body.fleetGroup).trim() : null) || null,
      customParams: req.body.customParams || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
    });
    res.json(ski);
  });

  // ─── Race fleet (team competition skis not tied to an athlete) ──────────────
  // ── Fleet-athlete backfill ────────────────────────────────────────────────
  // Race fleets ARE an athlete (a hidden one per team) so the whole Athlete
  // Skis page applies unchanged. Attach any legacy fleet skis (athlete_id
  // NULL) and their tests to that athlete. Idempotent; runs at every boot.
  (async () => {
    try {
      const { pool: pgFA } = await import("./db");
      const orphanTeams = await (pgFA as any).query(
        `SELECT DISTINCT team_id FROM race_skis WHERE athlete_id IS NULL AND team_id IS NOT NULL`);
      for (const row of orphanTeams.rows) {
        const teamId = row.team_id;
        let fa = await (pgFA as any).query(
          `SELECT id FROM athletes WHERE team_id = $1 AND is_fleet = 1 LIMIT 1`, [teamId]);
        let fleetId = fa.rows[0]?.id;
        if (!fleetId) {
          const ins = await (pgFA as any).query(
            `INSERT INTO athletes (name, created_at, created_by_id, created_by_name, team_id, is_fleet)
             VALUES ('Race fleets', $1, 0, 'System', $2, 1) RETURNING id`,
            [new Date().toISOString(), teamId]);
          fleetId = ins.rows[0].id;
        }
        await (pgFA as any).query(
          `UPDATE race_skis SET athlete_id = $1 WHERE athlete_id IS NULL AND team_id = $2`, [fleetId, teamId]);
        // Fleet tests (race-ski tests without an athlete) belong to it too —
        // that is what puts them on the fleet page's Tests tab.
        await (pgFA as any).query(
          `UPDATE tests SET athlete_id = $1
           WHERE team_id = $2 AND test_ski_source = 'raceskis' AND athlete_id IS NULL
             AND id IN (SELECT te.test_id FROM test_entries te JOIN race_skis rs ON rs.id = te.race_ski_id WHERE rs.athlete_id = $1)`,
          [fleetId, teamId]);
      }
      if (orphanTeams.rows.length > 0) console.log(`[fleet-athlete] backfilled ${orphanTeams.rows.length} team(s)`);
    } catch (e) { console.error("[fleet-athlete] backfill failed:", e); }
  })();

  // Manual race-use logs for an athlete's Race use tab: uses of their own
  // pairs plus fleet pairs they were picked as the user of. Not para-gated —
  // race use logging exists on every team.
  app.get("/api/athletes/:id/race-uses", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    if (!(await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, teamId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT su.id, su.date, su.location, su.discipline, su.result, su.notes,
              su.wax_notes AS "waxNotes", su.weather_id AS "weatherId", su.manual_weather AS "manualWeather",
              su.used_by_athlete_id AS "usedByAthleteId", ua.name AS "usedByName",
              rs.id AS "raceSkiId", rs.ski_id AS "skiLabel", rs.fleet_group AS "fleetGroup",
              rs.brand, rs.grind, su.created_by_name AS "createdByName"
       FROM ski_race_usages su
       JOIN race_skis rs ON rs.id = su.ski_id
       LEFT JOIN athletes ua ON ua.id = su.used_by_athlete_id
       WHERE su.team_id = $2 AND (su.athlete_id = $1 OR su.used_by_athlete_id = $1)
       ORDER BY su.date DESC, su.id DESC`,
      [athleteId, teamId]
    );
    res.json(r.rows);
  });

  // Everything a person has raced on: manual fleet-usage logs where they were
  // picked as the user, plus their race-prep entries resolved to team skis.
  app.get("/api/athletes/:id/ski-usages", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    if (!(await teamHasFeature(teamId, "para_team"))) {
      return res.status(403).json({ message: "Race fleet is not enabled for this team" });
    }
    if (!(await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, teamId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { pool } = await import("./db");
    const manual = await (pool as any).query(
      `SELECT su.id, 'usage' AS source, su.date, su.location, su.discipline,
              su.weather_id AS "weatherId", su.manual_weather AS "manualWeather",
              su.result, su.notes, su.wax_notes AS "waxNotes",
              rs.id AS "raceSkiId", rs.ski_id AS "skiLabel", rs.fleet_group AS "fleetGroup",
              rs.brand, rs.grind, su.created_by_name AS "createdByName"
       FROM ski_race_usages su JOIN race_skis rs ON rs.id = su.ski_id
       WHERE su.used_by_athlete_id = $1 AND su.team_id = $2
       ORDER BY su.date DESC`,
      [athleteId, teamId]
    );
    let prepRows: any[] = [];
    try {
      const pr = await (pool as any).query(
        `SELECT rpe.id, rp.date, rp.location, rp.discipline, rp.weather_id AS "weatherId",
                rpe.ski_id AS "skiId1", rpe.ski_id_classic AS "skiId2", rpe.ski_id_skating AS "skiId3",
                rpe.notes
         FROM race_prep_entries rpe JOIN race_preps rp ON rp.id = rpe.race_prep_id
         WHERE rpe.athlete_id = $1 AND rp.team_id = $2 ORDER BY rp.date DESC`,
        [athleteId, teamId]
      );
      const labels = Array.from(new Set(pr.rows.flatMap((r: any) => [r.skiId1, r.skiId2, r.skiId3]).filter(Boolean)));
      const skiByLabel = new Map<string, any>();
      if (labels.length > 0) {
        const sk = await (pool as any).query(
          `SELECT rs.id, rs.ski_id AS "skiLabel", rs.fleet_group AS "fleetGroup", rs.brand, rs.grind
           FROM race_skis rs JOIN athletes a ON a.id = rs.athlete_id
           WHERE a.team_id = $1 AND rs.ski_id = ANY($2::text[])`,
          [teamId, labels]
        );
        for (const row of sk.rows) skiByLabel.set(row.skiLabel, row);
      }
      prepRows = pr.rows.flatMap((r: any) =>
        [r.skiId1, r.skiId2, r.skiId3].filter(Boolean).map((label: string, i: number) => {
          const rs = skiByLabel.get(label);
          return {
            id: -(r.id * 10 + i), source: "raceprep", date: r.date, location: r.location,
            discipline: r.discipline, weatherId: r.weatherId, manualWeather: null,
            result: null, notes: r.notes, waxNotes: null,
            raceSkiId: rs?.id ?? null, skiLabel: label, fleetGroup: rs?.fleetGroup ?? null,
            brand: rs?.brand ?? null, grind: rs?.grind ?? null, createdByName: null,
          };
        })
      );
    } catch { /* additive */ }
    res.json([...manual.rows, ...prepRows]);
  });

  // Repair drifted prep entries: single-discipline races with labels stuck in
  // the classic/skating columns (made both old and new pair count as raced).
  (async () => {
    try {
      const { pool: pgFix } = await import("./db");
      const r = await (pgFix as any).query(
        `UPDATE race_prep_entries rpe
         SET ski_id = COALESCE(rpe.ski_id, rpe.ski_id_classic, rpe.ski_id_skating),
             ski_id_classic = NULL, ski_id_skating = NULL,
             borrowed_athlete_id = COALESCE(rpe.borrowed_athlete_id, rpe.borrowed_athlete_id_classic, rpe.borrowed_athlete_id_skating),
             borrowed_athlete_id_classic = NULL, borrowed_athlete_id_skating = NULL
         FROM race_preps rp
         WHERE rp.id = rpe.race_prep_id AND rp.discipline != 'Skiathlon'
           AND (rpe.ski_id_classic IS NOT NULL OR rpe.ski_id_skating IS NOT NULL)`);
      if (r.rowCount > 0) console.log(`[prep-slots] collapsed ${r.rowCount} drifted entries`);
    } catch (e) { console.error("[prep-slots] repair failed:", e); }
  })();

  // Resolve (and lazily create) the active team's fleet athlete — the client's
  // /race-fleet route redirects to /raceskis/<id>.
  app.get("/api/race-fleet/athlete", requirePermission("raceskis", "view"), async (req, res) => {
    if (!(await requireParaTeam(req, res))) return;
    const teamId = getActiveTeamId(req);
    const { pool: pgFA } = await import("./db");
    let fa = await (pgFA as any).query(`SELECT id FROM athletes WHERE team_id = $1 AND is_fleet = 1 LIMIT 1`, [teamId]);
    let fleetId = fa.rows[0]?.id;
    if (!fleetId) {
      const ins = await (pgFA as any).query(
        `INSERT INTO athletes (name, created_at, created_by_id, created_by_name, team_id, is_fleet)
         VALUES ('Race fleets', $1, 0, 'System', $2, 1) RETURNING id`,
        [new Date().toISOString(), teamId]);
      fleetId = ins.rows[0].id;
    }
    res.json({ athleteId: fleetId });
  });

  // Enabled by the "para_team" feature. Fleet skis live in race_skis with a null
  // athlete_id and a team_id, and may be flagged as a sit-ski.
  async function requireParaTeam(req: Request, res: Response): Promise<boolean> {
    const teamId = getActiveTeamId(req);
    const team = await storage.getTeam(teamId);
    let enabled = false;
    try { enabled = !!team?.enabledAreas && JSON.parse(team.enabledAreas).includes("para_team"); } catch {}
    if (!enabled) { res.status(403).json({ message: "Race fleet is not enabled for this team" }); return false; }
    return true;
  }

  app.get("/api/race-fleet", requirePermission("raceskis", "view"), async (req, res) => {
    if (!(await requireParaTeam(req, res))) return;
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT id, serial_number AS "serialNumber", ski_id AS "skiId", brand, discipline, construction, mold, base,
              grind, heights, year, length, type_of_ski AS "typeOfSki", where_received AS "whereReceived", notes,
              is_training_ski AS "isTrainingSki", is_sitski AS "isSitski", custom_params AS "customParams",
              archived_at AS "archivedAt", created_at AS "createdAt", created_by_name AS "createdByName",
              updated_at AS "updatedAt", updated_by_name AS "updatedByName", fleet_group AS "fleetGroup"
       FROM race_skis WHERE athlete_id IS NULL AND team_id = $1 ORDER BY fleet_group NULLS LAST, id DESC`, [teamId]);

    // A ski register that only lists specifications answers the wrong question.
    // Before a race what you need to know is what each pair has actually done:
    // how it has tested, when it last raced and how long since the grind.
    const ids = r.rows.map((x: any) => x.id);
    if (ids.length) {
      const [tests, races, grinds] = await Promise.all([
        (pool as any).query(
          `SELECT te.race_ski_id AS id, COUNT(*)::int AS n, MAX(t.date) AS last,
                  MIN(te.rank_0km) FILTER (WHERE te.rank_0km IS NOT NULL) AS best,
                  COUNT(*) FILTER (WHERE te.rank_0km = 1)::int AS wins,
                  ROUND(AVG(te.rank_0km) FILTER (WHERE te.rank_0km IS NOT NULL), 2) AS "avgRank"
           FROM test_entries te JOIN tests t ON t.id = te.test_id
           WHERE te.race_ski_id = ANY($1::int[]) GROUP BY te.race_ski_id`, [ids]),
        (pool as any).query(
          `WITH combined AS (
             SELECT u.ski_id AS id, u.date, u.location, u.result
             FROM ski_race_usages u WHERE u.ski_id = ANY($1::int[])
             UNION ALL
             SELECT rs.id, rp.date, rp.location, NULL AS result
             FROM race_prep_entries rpe
             JOIN race_preps rp ON rp.id = rpe.race_prep_id AND rp.team_id = $2
             JOIN race_skis rs ON rs.id = ANY($1::int[])
              AND rs.ski_id IN (rpe.ski_id, rpe.ski_id_classic, rpe.ski_id_skating)
           )
           SELECT DISTINCT ON (id) id, date, location, result,
                  COUNT(*) OVER (PARTITION BY id)::int AS n
           FROM combined ORDER BY id, date DESC`, [ids, teamId]),
        (pool as any).query(
          `SELECT DISTINCT ON (race_ski_id) race_ski_id AS id, date, grind_type AS "grindType"
           FROM race_ski_regrinds WHERE race_ski_id = ANY($1::int[]) ORDER BY race_ski_id, date DESC`, [ids]),
      ]);
      const byId = <T extends { id: number }>(rows: T[]) => new Map(rows.map((x) => [x.id, x]));
      const tMap = byId(tests.rows), rMap = byId(races.rows), gMap = byId(grinds.rows);
      for (const row of r.rows) {
        const t = tMap.get(row.id) as any, ra = rMap.get(row.id) as any, g = gMap.get(row.id) as any;
        row.testCount = t?.n ?? 0;
        row.lastTestDate = t?.last ?? null;
        row.bestRank = t?.best ?? null;
        row.winCount = t?.wins ?? 0;
        row.avgRank = t?.avgRank != null ? Number(t.avgRank) : null;
        row.raceCount = ra?.n ?? 0;
        row.lastRaceDate = ra?.date ?? null;
        row.lastRaceLocation = ra?.location ?? null;
        row.lastRaceResult = ra?.result ?? null;
        row.lastGrindDate = g?.date ?? null;
        row.lastGrindType = g?.grindType ?? null;
      }
    }
    res.json(r.rows);
  });

  app.post("/api/race-fleet", requirePermission("raceskis", "edit"), async (req, res) => {
    if (!(await requireParaTeam(req, res))) return;
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    if (!req.body.skiId || !req.body.discipline) return res.status(400).json({ message: "skiId and discipline are required" });
    const { pool } = await import("./db");
    const now = new Date().toISOString();
    const r = await (pool as any).query(
      `INSERT INTO race_skis (athlete_id, team_id, serial_number, ski_id, brand, discipline, construction, mold, base,
              grind, heights, year, length, type_of_ski, where_received, notes, is_training_ski, is_sitski, custom_params,
              created_at, created_by_id, created_by_name, fleet_group)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING id`,
      [teamId, req.body.serialNumber || null, req.body.skiId, req.body.brand || null, req.body.discipline,
       req.body.construction || null, req.body.mold || null, req.body.base || null, req.body.grind || null,
       req.body.heights || null, req.body.year || null, req.body.length || null, req.body.typeOfSki || null,
       req.body.whereReceived || null, req.body.notes || null, req.body.isTrainingSki ? 1 : 0,
       req.body.isSitski ? 1 : 0, req.body.customParams || null, now, u.id, u.name,
       (req.body.fleetGroup || "").trim() || null]);
    res.json({ ok: true, id: r.rows[0]?.id });
  });

  // Every test involving the team's fleet skis — one row per test, with the
  // participating pairs and the best-placed fleet pair.
  app.get("/api/race-fleet/all-tests", requirePermission("raceskis", "view"), async (req, res) => {
    if (!(await requireParaTeam(req, res))) return;
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT t.id AS "testId", t.date, t.location, t.test_name AS "testName", t.test_type AS "testType",
              t.result_unit AS "resultUnit", t.created_by_name AS "createdByName",
              w.air_temperature_c AS "airTemperatureC", w.snow_temperature_c AS "snowTemperatureC", w.snow_type AS "snowType",
              COUNT(*)::int AS "fleetEntryCount",
              array_agg(rs.ski_id ORDER BY te.rank_0km NULLS LAST) AS "pairLabels",
              array_agg(rs.fleet_group ORDER BY te.rank_0km NULLS LAST) AS "pairGroups",
              MIN(te.rank_0km) AS "bestRank",
              json_agg(json_build_object(
                'skiLabel', rs.ski_id, 'group', rs.fleet_group, 'grind', rs.grind,
                'rank', te.rank_0km, 'result', te.result_0km_cm_behind
              ) ORDER BY te.rank_0km NULLS LAST) AS "entries"
       FROM tests t
       JOIN test_entries te ON te.test_id = t.id
       JOIN race_skis rs ON rs.id = te.race_ski_id AND rs.athlete_id IS NULL AND rs.team_id = $1
       LEFT JOIN daily_weather w ON w.id = t.weather_id
       WHERE t.team_id = $1
       GROUP BY t.id, w.air_temperature_c, w.snow_temperature_c, w.snow_type
       ORDER BY t.date DESC, t.id DESC`, [teamId]);
    res.json(r.rows);
  });

  // Test history for ONE fleet ski — date, test, rank and result per entry.
  app.get("/api/race-fleet/:id/tests", requirePermission("raceskis", "view"), async (req, res) => {
    if (!(await requireParaTeam(req, res))) return;
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    const own = await (pool as any).query(`SELECT id FROM race_skis WHERE id = $1 AND athlete_id IS NULL AND team_id = $2`, [id, teamId]);
    if (own.rows.length === 0) return res.status(404).json({ message: "Not found" });
    const r = await (pool as any).query(
      `SELECT t.id AS "testId", t.date, t.location, t.test_name AS "testName", t.test_type AS "testType",
              t.result_unit AS "resultUnit", te.rank_0km AS "rank", te.result_0km_cm_behind AS "result", te.results,
              w.air_temperature_c AS "airTemperatureC", w.snow_temperature_c AS "snowTemperatureC", w.snow_type AS "snowType"
       FROM test_entries te JOIN tests t ON t.id = te.test_id
       LEFT JOIN daily_weather w ON w.id = t.weather_id
       WHERE te.race_ski_id = $1 AND t.team_id = $2
       ORDER BY t.date DESC, t.id DESC`, [id, teamId]);
    res.json(r.rows);
  });

  // Every test row for a whole series/group, with conditions — feeds the
  // "which conditions does this series perform in" breakdown.
  app.get("/api/race-fleet/group-tests", requirePermission("raceskis", "view"), async (req, res) => {
    if (!(await requireParaTeam(req, res))) return;
    const teamId = getActiveTeamId(req);
    const group = String(req.query.group ?? "").trim();
    if (!group) return res.json([]);
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT rs.id AS "raceSkiId", rs.ski_id AS "skiLabel", t.date, te.rank_0km AS "rank",
              w.air_temperature_c AS "airTemperatureC", w.snow_temperature_c AS "snowTemperatureC", w.snow_type AS "snowType"
       FROM race_skis rs
       JOIN test_entries te ON te.race_ski_id = rs.id
       JOIN tests t ON t.id = te.test_id AND t.team_id = $2
       LEFT JOIN daily_weather w ON w.id = t.weather_id
       WHERE rs.athlete_id IS NULL AND rs.team_id = $2 AND rs.fleet_group = $1
       ORDER BY t.date DESC`, [group, teamId]);
    res.json(r.rows);
  });

  app.put("/api/race-fleet/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    if (!(await requireParaTeam(req, res))) return;
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    // Only fleet skis belonging to the active team may be edited here.
    const own = await (pool as any).query(`SELECT id FROM race_skis WHERE id = $1 AND athlete_id IS NULL AND team_id = $2`, [id, teamId]);
    if (own.rows.length === 0) return res.status(404).json({ message: "Not found" });
    const cols: Record<string, string> = {
      serialNumber: "serial_number", skiId: "ski_id", brand: "brand", discipline: "discipline", construction: "construction",
      mold: "mold", base: "base", grind: "grind", heights: "heights", year: "year", length: "length",
      typeOfSki: "type_of_ski", whereReceived: "where_received", notes: "notes", customParams: "custom_params",
      fleetGroup: "fleet_group",
    };
    const sets: string[] = []; const vals: any[] = [];
    for (const [k, col] of Object.entries(cols)) {
      if (req.body[k] !== undefined) { vals.push(req.body[k] || null); sets.push(`${col} = $${vals.length}`); }
    }
    if (req.body.isTrainingSki !== undefined) { vals.push(req.body.isTrainingSki ? 1 : 0); sets.push(`is_training_ski = $${vals.length}`); }
    if (req.body.isSitski !== undefined) { vals.push(req.body.isSitski ? 1 : 0); sets.push(`is_sitski = $${vals.length}`); }
    if (sets.length === 0) return res.json({ ok: true });
    vals.push(id);
    await (pool as any).query(`UPDATE race_skis SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
    await stampEdit("race_skis", id, req);
    res.json({ ok: true });
  });

  app.delete("/api/race-fleet/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    if (!(await requireParaTeam(req, res))) return;
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    const own = await (pool as any).query(`SELECT * FROM race_skis WHERE id = $1 AND athlete_id IS NULL AND team_id = $2`, [id, teamId]);
    if (own.rows.length === 0) return res.status(404).json({ message: "Not found" });
    const snapRegrinds = await (pool as any).query(`SELECT * FROM race_ski_regrinds WHERE race_ski_id = $1`, [id]).catch(() => ({ rows: [] }));
    await (pool as any).query(`DELETE FROM race_ski_regrinds WHERE race_ski_id = $1`, [id]).catch(() => {});
    await (pool as any).query(`DELETE FROM race_skis WHERE id = $1`, [id]);
    await recordDeletion(req, "race_fleet_ski", id, `Fleet ski deleted: ${own.rows[0]?.ski_id ?? id}`, { ski: own.rows[0], regrinds: snapRegrinds.rows });
    res.json({ ok: true });
  });

  app.put("/api/race-skis/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const data: any = {};
    if (req.body.serialNumber !== undefined) data.serialNumber = req.body.serialNumber;
    if (req.body.skiId !== undefined) data.skiId = req.body.skiId;
    if (req.body.brand !== undefined) data.brand = req.body.brand;
    if (req.body.discipline !== undefined) data.discipline = req.body.discipline;
    if (req.body.construction !== undefined) data.construction = req.body.construction;
    if (req.body.mold !== undefined) data.mold = req.body.mold;
    if (req.body.base !== undefined) data.base = req.body.base;
    if (req.body.grind !== undefined) data.grind = req.body.grind;
    if (req.body.heights !== undefined) data.heights = req.body.heights;
    if (req.body.year !== undefined) data.year = req.body.year;
    if (req.body.length !== undefined) data.length = req.body.length;
    if (req.body.typeOfSki !== undefined) data.typeOfSki = req.body.typeOfSki;
    if (req.body.whereReceived !== undefined) data.whereReceived = req.body.whereReceived;
    if (req.body.notes !== undefined) data.notes = req.body.notes;
    if (req.body.isTrainingSki !== undefined) data.isTrainingSki = req.body.isTrainingSki ? 1 : 0;
    if (req.body.customParams !== undefined) data.customParams = req.body.customParams;
    if (req.body.fleetGroup !== undefined) data.fleetGroup = (String(req.body.fleetGroup).trim() || null) as any;
    if (req.body.isSitski !== undefined) data.isSitski = req.body.isSitski ? 1 : 0;
    const updated = await storage.updateRaceSki(id, data);
    await recordChange(req, "race_ski", id, `Race ski edited: ${ski.skiId}${ski.brand ? ` (${ski.brand})` : ""}`, ski, updated);
    await stampEdit("race_skis", id, req);
    res.json(updated);
  });

  app.get("/api/athletes/:athleteId/skis/archived", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.athleteId);
    const hasAccess = await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const list = await storage.listArchivedRaceSkis(athleteId);
    res.json(list);
  });

  // ── Ski race usages (waxer-logged: "this ski pair was raced", no admin prep needed) ──
  // Everything about one pair for its detail page: the ski itself, every test
  // it took part in (with full result lists so its row can be highlighted),
  // and how many times it has raced.
  app.get("/api/race-skis/:id/tests", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const skiId = parseInt(req.params.id);
    const ski = await storage.getRaceSki(skiId);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const teamId = getActiveTeamId(req);
    const { pool: pg } = await import("./db");
    const testsRes = await (pg as any).query(
      `SELECT DISTINCT t.id, t.date, t.location, t.test_type AS "testType", t.notes,
              t.weather_id AS "weatherId", t.distance_labels AS "distanceLabels",
              t.result_unit AS "resultUnit", t.athlete_id AS "athleteId",
              w.air_temperature_c AS "airTemperatureC", w.snow_temperature_c AS "snowTemperatureC",
              w.air_humidity_pct AS "airHumidityPct", w.snow_humidity_pct AS "snowHumidityPct",
              w.snow_type AS "snowType", w.artificial_snow AS "artificialSnow", w.natural_snow AS "naturalSnow",
              w.grain_size AS "grainSize", w.snow_humidity_type AS "snowHumidityType",
              w.track_hardness AS "trackHardness", w.wind, w.clouds, w.precipitation
       FROM test_entries te
       JOIN tests t ON t.id = te.test_id
       LEFT JOIN daily_weather w ON w.id = t.weather_id
       WHERE t.team_id = $1 AND te.race_ski_id = $2
       ORDER BY t.date DESC, t.id DESC`,
      [teamId, skiId]
    );
    const testIds: number[] = testsRes.rows.map((r: any) => r.id);
    let entriesByTestId: Record<number, any[]> = {};
    if (testIds.length > 0) {
      const er = await (pg as any).query(
        `SELECT te.id, te.test_id AS "testId", te.ski_number AS "skiNumber", te.race_ski_id AS "raceSkiId",
                te.product_id AS "productId", te.free_text_product AS "freeTextProduct",
                te.result_0km_cm_behind AS "result0kmCmBehind", te.rank_0km AS "rank0km",
                te.results, te.feeling_rank AS "feelingRank",
                rs.ski_id AS "skiLabel", rs.fleet_group AS "fleetGroup",
                p.brand AS "productBrand", p.name AS "productName"
         FROM test_entries te
         LEFT JOIN race_skis rs ON rs.id = te.race_ski_id
         LEFT JOIN products p ON p.id = te.product_id
         WHERE te.test_id = ANY($1)
         ORDER BY te.ski_number ASC`,
        [testIds]
      );
      for (const row of er.rows) {
        (entriesByTestId[row.testId] ||= []).push(row);
      }
    }
    // Times raced: manual usage logs + race-prep entries matching the label.
    let racedCount = 0;
    try {
      const [uc, pc] = await Promise.all([
        (pg as any).query(`SELECT COUNT(*)::int AS c FROM ski_race_usages WHERE ski_id = $1 AND team_id = $2`, [skiId, teamId]),
        (pg as any).query(
          `SELECT COUNT(*)::int AS c FROM race_prep_entries rpe JOIN race_preps rp ON rp.id = rpe.race_prep_id
           WHERE rp.team_id = $1 AND (rpe.ski_id = $2 OR rpe.ski_id_classic = $2 OR rpe.ski_id_skating = $2)`,
          [teamId, ski.skiId]),
      ]);
      racedCount = (uc.rows[0]?.c || 0) + (pc.rows[0]?.c || 0);
    } catch { /* additive */ }
    res.json({ ski, tests: testsRes.rows, entriesByTestId, racedCount });
  });

  app.get("/api/race-skis/:id/usages", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const skiId = parseInt(req.params.id);
    const ski = await storage.getRaceSki(skiId);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT su.id, su.ski_id AS "skiId", su.athlete_id AS "athleteId", su.date, su.location, su.discipline,
              su.weather_id AS "weatherId", su.manual_weather AS "manualWeather", su.result, su.notes,
              su.athlete_rating AS "athleteRating", su.athlete_comment AS "athleteComment",
              su.used_by_athlete_id AS "usedByAthleteId", ua.name AS "usedByName", su.wax_notes AS "waxNotes",
              su.created_by_name AS "createdByName", su.created_at AS "createdAt"
       FROM ski_race_usages su LEFT JOIN athletes ua ON ua.id = su.used_by_athlete_id
       WHERE su.ski_id = $1 AND su.team_id = $2 ORDER BY su.date DESC`,
      [skiId, getActiveTeamId(req)]
    );
    // Race-prep days where this pair's ski-ID was entered also count as use —
    // the prep already knows who raced it, where and when.
    let prepRows: any[] = [];
    try {
      const pr = await (pool as any).query(
        `SELECT rpe.id, rp.date, rp.location, rp.discipline, rp.weather_id AS "weatherId",
                rpe.athlete_id AS "usedByAthleteId", rpe.athlete_name AS "usedByName", rpe.notes
         FROM race_prep_entries rpe JOIN race_preps rp ON rp.id = rpe.race_prep_id
         WHERE rp.team_id = $1 AND (rpe.ski_id = $2 OR rpe.ski_id_classic = $2 OR rpe.ski_id_skating = $2)
         ORDER BY rp.date DESC`,
        [getActiveTeamId(req), ski.skiId]
      );
      prepRows = pr.rows.map((r: any) => ({ ...r, id: -r.id, source: "raceprep" }));
    } catch { /* additive */ }
    res.json([...result.rows, ...prepRows]);
  });

  app.post("/api/race-skis/:id/usages", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const skiId = parseInt(req.params.id);
    const ski = await storage.getRaceSki(skiId);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const { date, location, discipline, weatherId, manualWeather, result: raceResult, notes, usedByAthleteId, waxNotes } = req.body;
    // #18: date is optional. The column is NOT NULL, so store "" when omitted.
    const { pool } = await import("./db");
    const paraOn = await teamHasFeature(getActiveTeamId(req), "para_team");
    const usedBy = paraOn && usedByAthleteId != null && usedByAthleteId !== "" ? parseInt(String(usedByAthleteId)) : null;
    const inserted = await (pool as any).query(
      `INSERT INTO ski_race_usages (ski_id, athlete_id, team_id, date, location, discipline, weather_id, manual_weather, result, notes, used_by_athlete_id, wax_notes, created_by_id, created_by_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [skiId, ski.athleteId, getActiveTeamId(req), date || "", location || null, discipline || null,
       weatherId || null, manualWeather ? (typeof manualWeather === "string" ? manualWeather : JSON.stringify(manualWeather)) : null,
       raceResult || null, notes || null, usedBy && !isNaN(usedBy) ? usedBy : null, paraOn ? waxNotes || null : null, u.id, u.name, new Date().toISOString()]
    );
    res.json({ id: inserted.rows[0].id });
  });

  app.delete("/api/race-skis/:id/usages/:usageId", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const skiId = parseInt(req.params.id);
    const usageId = parseInt(req.params.usageId);
    const ski = await storage.getRaceSki(skiId);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    await (pool as any).query(`DELETE FROM ski_race_usages WHERE id = $1 AND ski_id = $2 AND team_id = $3`, [usageId, skiId, getActiveTeamId(req)]);
    res.json({ ok: true });
  });

  // Waxer enters/edits the athlete feedback (rating + comment) for a race use,
  // directly from the ski page — the same data the athlete feedback link sets.
  app.patch("/api/race-skis/:id/usages/:usageId/feedback", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const skiId = parseInt(req.params.id);
    const usageId = parseInt(req.params.usageId);
    const ski = await storage.getRaceSki(skiId);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE ski_race_usages SET athlete_rating = $1, athlete_comment = $2 WHERE id = $3 AND ski_id = $4 AND team_id = $5`,
      [req.body.athleteRating || null, req.body.athleteComment || null, usageId, skiId, getActiveTeamId(req)]);
    res.json({ ok: true });
  });

  // Team-wide raced-skis feed for analytics ("which ski pairs were raced in which conditions")
  app.get("/api/ski-race-usages", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT su.id, su.date, su.location, su.discipline, su.result, su.notes,
              su.manual_weather AS "manualWeather", su.created_by_name AS "createdByName",
              rs.ski_id AS "skiId", rs.brand, su.athlete_id AS "athleteId", a.name AS "athleteName",
              w.snow_temperature_c AS "snowTemperatureC", w.air_temperature_c AS "airTemperatureC",
              w.snow_type AS "snowType", w.track_hardness AS "trackHardness"
       FROM ski_race_usages su
       JOIN race_skis rs ON rs.id = su.ski_id
       JOIN athletes a ON a.id = su.athlete_id
       LEFT JOIN daily_weather w ON w.id = su.weather_id
       WHERE su.team_id = $1
       ORDER BY su.date DESC`,
      [teamId]
    );
    let rows = result.rows;
    if (!u.isScopeAdmin) {
      const accessible = new Set((await storage.listAthletes(u.id, false, teamId)).map((a: any) => a.id));
      rows = rows.filter((r: any) => accessible.has(r.athleteId));
    }
    res.json(rows);
  });

  // Race-prep entries (with athlete feedback) that used this ski pair — for the garage.
  app.get("/api/race-skis/:id/prep-feedback", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const ski = await storage.getRaceSki(parseInt(req.params.id));
    if (!ski) return res.status(404).json({ message: "Not found" });
    if (!(await storage.hasAthleteAccess(ski.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req)))) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT rpe.id, rp.date, rp.location, rp.discipline,
              rpe.athlete_rating AS "athleteRating", rpe.athlete_comment AS "athleteComment"
       FROM race_prep_entries rpe JOIN race_preps rp ON rp.id = rpe.race_prep_id
       WHERE rpe.athlete_id = $1 AND rp.team_id = $2
         AND (rpe.ski_id = $3 OR rpe.ski_id_classic = $3 OR rpe.ski_id_skating = $3)
         AND rpe.athlete_rating IS NOT NULL
       ORDER BY rp.date DESC`,
      [ski.athleteId, getActiveTeamId(req), ski.skiId]
    );
    res.json(r.rows);
  });

  // ── Athlete feedback links (per athlete; open public link; revocable) ──────────
  app.get("/api/athletes/:id/feedback-link", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.id);
    if (!(await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req)))) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const r = await (pool as any).query(`SELECT token FROM feedback_links WHERE athlete_id=$1 AND team_id=$2 AND revoked=0 ORDER BY id DESC LIMIT 1`, [athleteId, getActiveTeamId(req)]);
    res.json({ token: r.rows[0]?.token ?? null });
  });

  app.post("/api/athletes/:id/feedback-link", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.id);
    if (!(await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req)))) return res.status(403).json({ message: "Forbidden" });
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const existing = await (pool as any).query(`SELECT token FROM feedback_links WHERE athlete_id=$1 AND team_id=$2 AND revoked=0 ORDER BY id DESC LIMIT 1`, [athleteId, teamId]);
    if (existing.rows.length) return res.json({ token: existing.rows[0].token });
    const token = (await import("crypto")).randomUUID().replace(/-/g, "");
    await (pool as any).query(`INSERT INTO feedback_links (token, athlete_id, team_id, created_by_id, created_by_name, created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [token, athleteId, teamId, u.id, u.name, new Date().toISOString()]);
    res.json({ token });
  });

  app.post("/api/athletes/:id/feedback-link/revoke", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.id);
    if (!(await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req)))) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    await (pool as any).query(`UPDATE feedback_links SET revoked=1 WHERE athlete_id=$1 AND team_id=$2`, [athleteId, getActiveTeamId(req)]);
    res.json({ ok: true });
  });

  // ── Share-view accounts ────────────────────────────────────────────────────
  // A waxer creates a read-only "athlete-access" login that can see only the
  // athletes it has been granted (via athlete_access). One account can hold
  // several athletes and switch between them; access can be revoked anytime.
  app.get("/api/athletes/:id/share-accounts", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    if (!(await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, teamId))) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const withAccess = await (pool as any).query(
      `SELECT us.id, us.name, us.email FROM users us
       JOIN athlete_access aa ON aa.user_id = us.id
       WHERE aa.athlete_id = $1 AND us.is_athlete_access = 1 ORDER BY us.name`, [athleteId]);
    const others = await (pool as any).query(
      `SELECT id, name, email FROM users
       WHERE is_athlete_access = 1 AND team_id = $1
         AND id NOT IN (SELECT user_id FROM athlete_access WHERE athlete_id = $2)
       ORDER BY name`, [teamId, athleteId]);
    res.json({ withAccess: withAccess.rows, others: others.rows });
  });

  app.post("/api/athletes/:id/share-account", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    if (!(await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, teamId))) return res.status(403).json({ message: "Forbidden" });
    const email = String(req.body.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return res.status(400).json({ message: "Valid email required" });
    const pwError = validatePassword(req.body.password);
    if (pwError) return res.status(400).json({ message: pwError });
    if (await storage.getUserByEmail(email)) return res.status(409).json({ message: "Email already in use" });
    const athlete = await storage.getAthlete(athleteId);
    const { DEFAULT_PERMISSIONS } = await import("@shared/schema");
    const perms = { ...DEFAULT_PERMISSIONS, dashboard: "view", tests: "view", raceskis: "view", analytics: "view", suggestions: "view" };
    const hashed = await hashPassword(req.body.password);
    const name = String(req.body.name ?? "").trim() || email.split("@")[0];
    const created = await storage.createUser({
      email, password: hashed, name, username: null as any, groupScope: "",
      isAdmin: 0, isTeamAdmin: 0, permissions: JSON.stringify(perms),
      teamId: (athlete as any)?.teamId || teamId, isBlindTester: 0,
      isAthleteAccess: 1, linkedAthleteId: athleteId,
      language: "no", createdAt: new Date().toISOString(),
    } as any);
    const { pool } = await import("./db");
    await (pool as any).query(`INSERT INTO athlete_access (athlete_id, user_id) VALUES ($1,$2)`, [athleteId, created.id]);
    res.json({ id: created.id, email: created.email, name: created.name });
  });

  app.post("/api/athletes/:id/share-accounts/:userId", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const teamId = getActiveTeamId(req);
    if (!(await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, teamId))) return res.status(403).json({ message: "Forbidden" });
    const target = await storage.getUser(userId);
    if (!target || (target as any).isAthleteAccess !== 1 || target.teamId !== teamId) return res.status(400).json({ message: "Not a share-view account in this team" });
    const { pool } = await import("./db");
    const exists = await (pool as any).query(`SELECT 1 FROM athlete_access WHERE athlete_id=$1 AND user_id=$2`, [athleteId, userId]);
    if (!exists.rows.length) await (pool as any).query(`INSERT INTO athlete_access (athlete_id, user_id) VALUES ($1,$2)`, [athleteId, userId]);
    if (!(target as any).linkedAthleteId) await (pool as any).query(`UPDATE users SET linked_athlete_id=$1 WHERE id=$2`, [athleteId, userId]);
    res.json({ ok: true });
  });

  app.delete("/api/athletes/:id/share-accounts/:userId", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const teamId = getActiveTeamId(req);
    if (!(await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, teamId))) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    await (pool as any).query(`DELETE FROM athlete_access WHERE athlete_id=$1 AND user_id=$2`, [athleteId, userId]);
    // If this was the account's active athlete, switch to another it still has.
    const target = await storage.getUser(userId);
    if (target && (target as any).linkedAthleteId === athleteId) {
      const next = await (pool as any).query(`SELECT athlete_id FROM athlete_access WHERE user_id=$1 LIMIT 1`, [userId]);
      await (pool as any).query(`UPDATE users SET linked_athlete_id=$1 WHERE id=$2`, [next.rows[0]?.athlete_id ?? null, userId]);
    }
    res.json({ ok: true });
  });

  // For a share-view account: the athletes it can switch between, and switching.
  app.get("/api/my/athletes", requireAuth, async (req, res) => {
    const u = req.user as any;
    const { pool } = await import("./db");
    const r = await (pool as any).query(
      `SELECT a.id, a.name FROM athletes a JOIN athlete_access aa ON aa.athlete_id = a.id
       WHERE aa.user_id = $1 ORDER BY a.name`, [u.id]);
    res.json({ athletes: r.rows, activeAthleteId: u.linkedAthleteId ?? null });
  });

  app.post("/api/my/active-athlete", requireAuth, async (req, res) => {
    const u = req.user as any;
    const athleteId = parseInt(req.body.athleteId);
    const { pool } = await import("./db");
    const ok = await (pool as any).query(`SELECT 1 FROM athlete_access WHERE athlete_id=$1 AND user_id=$2`, [athleteId, u.id]);
    if (!ok.rows.length) return res.status(403).json({ message: "No access to this athlete" });
    await (pool as any).query(`UPDATE users SET linked_athlete_id=$1 WHERE id=$2`, [athleteId, u.id]);
    res.json({ ok: true });
  });

  // TA/Admin: manage which athletes a share-view account can see, and whether it
  // may edit each. Accounts stay read-only unless an athlete is toggled editable.
  app.get("/api/users/:id/athlete-access", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const targetId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const u = userInfo(req);
    const target = await storage.getUser(targetId);
    if (!target || target.teamId !== teamId) return res.status(404).json({ message: "Not found" });
    const athletes = await storage.listAthletes(u.id, true, teamId);
    const { pool } = await import("./db");
    const grants = await (pool as any).query(`SELECT athlete_id AS "athleteId", can_edit AS "canEdit" FROM athlete_access WHERE user_id=$1`, [targetId]);
    const byId = new Map<number, number>(grants.rows.map((g: any) => [g.athleteId, g.canEdit]));
    res.json({
      isAthleteAccess: (target as any).isAthleteAccess === 1,
      athletes: athletes.map((a: any) => ({ id: a.id, name: a.name, assigned: byId.has(a.id), canEdit: byId.get(a.id) === 1 })),
    });
  });

  app.put("/api/users/:id/athlete-access", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const targetId = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const target = await storage.getUser(targetId);
    if (!target || target.teamId !== teamId) return res.status(404).json({ message: "Not found" });
    const grants: { athleteId: number; canEdit: boolean }[] = Array.isArray(req.body.grants) ? req.body.grants : [];
    const validIds = new Set((await storage.listAthletes(userInfo(req).id, true, teamId)).map((a: any) => a.id));
    const clean = grants.filter((g) => validIds.has(g.athleteId));
    const { pool } = await import("./db");
    await (pool as any).query(`DELETE FROM athlete_access WHERE user_id=$1`, [targetId]);
    for (const g of clean) {
      await (pool as any).query(`INSERT INTO athlete_access (athlete_id, user_id, can_edit) VALUES ($1,$2,$3)`, [g.athleteId, targetId, g.canEdit ? 1 : 0]);
    }
    // Recompute permissions: read-only base; raceskis "edit" only if ≥1 editable.
    const anyEdit = clean.some((g) => g.canEdit);
    const { DEFAULT_PERMISSIONS } = await import("@shared/schema");
    let perms: any;
    try { perms = { ...DEFAULT_PERMISSIONS, ...JSON.parse((target as any).permissions || "{}") }; } catch { perms = { ...DEFAULT_PERMISSIONS }; }
    perms.dashboard = "view"; perms.tests = "view"; perms.analytics = "view"; perms.suggestions = "view";
    perms.raceskis = anyEdit ? "edit" : "view";
    await storage.updateUser(targetId, { permissions: JSON.stringify(perms) } as any);
    // Keep an active athlete that is still granted.
    const linked = (target as any).linkedAthleteId;
    if (!clean.some((g) => g.athleteId === linked)) {
      await (pool as any).query(`UPDATE users SET linked_athlete_id=$1 WHERE id=$2`, [clean[0]?.athleteId ?? null, targetId]);
    }
    res.json({ ok: true });
  });

  // Public (no auth): athlete feedback page data + submit
  app.get("/api/feedback/:token", async (req, res) => {
    const { pool } = await import("./db");
    const link = await (pool as any).query(`SELECT athlete_id AS "athleteId", team_id AS "teamId" FROM feedback_links WHERE token=$1 AND revoked=0`, [req.params.token]);
    if (!link.rows.length) return res.status(404).json({ message: "invalid" });
    const { athleteId, teamId } = link.rows[0];
    const ath = await (pool as any).query(`SELECT name FROM athletes WHERE id=$1`, [athleteId]);
    const usages = await (pool as any).query(
      `SELECT su.id, su.date, su.location, su.discipline, rs.ski_id AS "skiId", rs.brand,
              su.athlete_rating AS "athleteRating", su.athlete_comment AS "athleteComment"
       FROM ski_race_usages su JOIN race_skis rs ON rs.id = su.ski_id
       WHERE su.athlete_id=$1 AND su.team_id=$2 ORDER BY su.date DESC`, [athleteId, teamId]
    );
    const preps = await (pool as any).query(
      `SELECT rpe.id, rp.date, rp.location, rp.discipline, rp.race_type AS "raceType",
              rpe.ski_id AS "skiId", rpe.ski_id_classic AS "skiIdClassic", rpe.ski_id_skating AS "skiIdSkating",
              rpe.athlete_rating AS "athleteRating", rpe.athlete_comment AS "athleteComment"
       FROM race_prep_entries rpe JOIN race_preps rp ON rp.id = rpe.race_prep_id
       WHERE rpe.athlete_id=$1 AND rp.team_id=$2 ORDER BY rp.date DESC`, [athleteId, teamId]
    );
    const items = [
      ...usages.rows.map((u: any) => ({ kind: "usage", id: u.id, date: u.date, location: u.location, discipline: u.discipline, distance: null, label: `${u.brand ? u.brand + " " : ""}${u.skiId}`, athleteRating: u.athleteRating, athleteComment: u.athleteComment })),
      ...preps.rows.map((p: any) => {
        const skis = [p.skiId, p.skiIdClassic, p.skiIdSkating].filter(Boolean).join(" / ");
        return { kind: "prep", id: p.id, date: p.date, location: p.location, discipline: p.discipline, distance: p.raceType || null, label: skis || p.raceType || "Race prep", athleteRating: p.athleteRating, athleteComment: p.athleteComment };
      }),
    ];
    res.json({ athleteName: ath.rows[0]?.name ?? "", items });
  });

  app.post("/api/feedback/:token", async (req, res) => {
    const { pool } = await import("./db");
    const link = await (pool as any).query(`SELECT athlete_id AS "athleteId", team_id AS "teamId" FROM feedback_links WHERE token=$1 AND revoked=0`, [req.params.token]);
    if (!link.rows.length) return res.status(404).json({ message: "invalid" });
    const { kind, id, rating, comment } = req.body;
    const { athleteId, teamId } = link.rows[0];
    if (kind === "prep") {
      await (pool as any).query(
        `UPDATE race_prep_entries rpe SET athlete_rating=$1, athlete_comment=$2
         FROM race_preps rp
         WHERE rpe.id=$3 AND rpe.athlete_id=$4 AND rp.id = rpe.race_prep_id AND rp.team_id=$5`,
        [rating || null, comment || null, parseInt(id), athleteId, teamId]
      );
    } else {
      await (pool as any).query(
        `UPDATE ski_race_usages SET athlete_rating=$1, athlete_comment=$2 WHERE id=$3 AND athlete_id=$4 AND team_id=$5`,
        [rating || null, comment || null, parseInt(id), athleteId, teamId]
      );
    }
    // Notify the athlete's waxers (inbox) that new feedback came in from the athlete.
    try {
      const ath = await (pool as any).query(`SELECT name FROM athletes WHERE id=$1`, [athleteId]);
      const athleteName = ath.rows[0]?.name || "Athlete";
      const subject = `${athleteName}: ny tilbakemelding / new feedback${rating ? ` (${rating})` : ""}`;
      const body = comment ? String(comment) : (rating ? String(rating) : "");
      const recipients = await (pool as any).query(
        `SELECT DISTINCT user_id AS "userId" FROM athlete_access WHERE athlete_id = $1`, [athleteId]);
      for (const r of recipients.rows) {
        await (pool as any).query(
          `INSERT INTO inbox_messages (team_id, to_user_id, from_name, subject, body, is_read, created_at, action_type, action_data)
           VALUES ($1,$2,$3,$4,$5,0,NOW(),$6,$7)`,
          [teamId, r.userId, athleteName, subject, body, "athlete_feedback", JSON.stringify({ athleteId })]);
      }
    } catch (e) { console.error("Failed to send athlete-feedback notifications:", e); }
    res.json({ ok: true });
  });

  // ── Athlete Race Calendar ───────────────────────────────────────────────────

  app.get("/api/athletes/:id/races", requirePermission("raceskis", "view"), async (req, res) => {
    const athleteId = parseInt(req.params.id);
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    // Athlete access users may only view their own linked athlete
    if (u.isAthleteAccess === 1 && !(await storage.hasAthleteAccess(athleteId, u.id, false, teamId))) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT id, athlete_id AS "athleteId", team_id AS "teamId", date, race_name AS "raceName",
              location, discipline, notes, created_at AS "createdAt"
       FROM athlete_race_calendar WHERE athlete_id = $1 AND team_id = $2 ORDER BY date ASC`,
      [athleteId, teamId]
    );
    return res.json(result.rows);
  });

  app.post("/api/athletes/:id/races", requirePermission("raceskis", "edit"), async (req, res) => {
    const athleteId = parseInt(req.params.id);
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const { date, raceName, location, discipline, notes } = req.body;
    if (!date || !raceName) return res.status(400).json({ message: "date and raceName required" });
    const { pool } = await import("./db");
    // Verify athlete belongs to this team
    const athCheck = await (pool as any).query(
      `SELECT id FROM athletes WHERE id = $1 AND team_id = $2`, [athleteId, teamId]
    );
    if (!athCheck.rows.length) return res.status(403).json({ message: "Forbidden" });
    const result = await (pool as any).query(
      `INSERT INTO athlete_race_calendar (athlete_id, team_id, date, race_name, location, discipline, notes, created_by_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [athleteId, teamId, date, raceName, location || null, discipline || null, notes || null, u.id, new Date().toISOString()]
    );
    return res.json({ id: result.rows[0].id });
  });

  app.delete("/api/athletes/:id/races/:raceId", requirePermission("raceskis", "edit"), async (req, res) => {
    const raceId = parseInt(req.params.raceId);
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const { pool } = await import("./db");
    await (pool as any).query(
      `DELETE FROM athlete_race_calendar WHERE id = $1 AND team_id = $2`,
      [raceId, teamId]
    );
    return res.json({ ok: true });
  });

  // ── Race Preps ──────────────────────────────────────────────────────────────

  // Whether the requester may see the glide/structure work on race preps.
  // Ski-waxers (raceprepGlide = none) see start lists, skis, weather, kick/binder
  // and comments, but not the glide/structure products & applications.
  function canSeeRacePrepGlide(req: Request): boolean {
    const info = userInfo(req);
    if (info.isScopeAdmin) return true;
    return (info.permissions as any).raceprepGlide !== "none";
  }
  // Remove glide/structure fields from a race-prep row.
  function stripGlide<T extends Record<string, any>>(row: T): T {
    return {
      ...row,
      products: undefined, method: undefined, structure: undefined,
      productIds: undefined, structureIds: undefined,
      productApps: undefined, structureApps: undefined,
    };
  }

  // Allow access via either the Race Prep zone (raceprep) or the athlete/Race
  // Skis area (raceskis) — used for race-prep comments which appear in both.
  function requireRaceprepOrRaceskis(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated?.() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    const info = userInfo(req);
    if (info.isScopeAdmin) return next();
    if (info.permissions.raceprep !== "none" || info.permissions.raceskis !== "none") return next();
    return res.status(403).json({ message: "Forbidden" });
  }

  app.get("/api/race-preps", requirePermission("raceprep", "view"), async (req, res) => {
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const { pool } = await import("./db");
    // Athlete Access users: only see race preps they participated in
    if (u.isAthleteAccess === 1 && u.linkedAthleteId) {
      const result = await (pool as any).query(
        `SELECT rp.id, rp.team_id AS "teamId", rp.date, rp.start_time AS "startTime", rp.location,
                rp.race_type AS "raceType", rp.discipline,
                rp.product_ids AS "productIds", rp.structure_ids AS "structureIds",
                rp.kick_product_ids AS "kickProductIds", rp.tette,
                rp.weather_id AS "weatherId",
                rp.created_by_name AS "createdByName", rp.created_at AS "createdAt"
         FROM race_preps rp
         INNER JOIN race_prep_entries rpe ON rpe.race_prep_id = rp.id AND rpe.athlete_id = $1
         WHERE rp.team_id = $2
         ORDER BY rp.date DESC`,
        [u.linkedAthleteId, teamId]
      );
      // Strip product/method/structure/notes from response for athlete access
      return res.json(result.rows.map((r: any) => ({ ...r, products: undefined, method: undefined, structure: undefined, notes: undefined })));
    }
    const result = await (pool as any).query(
      `SELECT id, team_id AS "teamId", date, start_time AS "startTime", location, race_type AS "raceType", discipline,
              products, method, structure, notes,
              product_ids AS "productIds", structure_ids AS "structureIds", kick_product_ids AS "kickProductIds", tette,
              product_apps AS "productApps", structure_apps AS "structureApps",
              weather_id AS "weatherId",
              created_by_id AS "createdById", created_by_name AS "createdByName", created_at AS "createdAt"
       FROM race_preps WHERE team_id = $1 ORDER BY date DESC`,
      [teamId]
    );
    const showGlide = canSeeRacePrepGlide(req);
    return res.json(showGlide ? result.rows : result.rows.map(stripGlide));
  });

  app.post("/api/race-preps", requirePermission("raceprep", "edit"), async (req, res) => {
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const { date, startTime, location, raceType, discipline, products, method, structure, notes, productIds, structureIds, kickProductIds, tette, weatherId, productApps, structureApps } = req.body;
    if (!date || !startTime || !location || !raceType || !discipline) return res.status(400).json({ message: "date, startTime, location, raceType, discipline required" });
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `INSERT INTO race_preps (team_id, date, start_time, location, race_type, discipline, products, method, structure, notes, product_ids, structure_ids, kick_product_ids, tette, weather_id, product_apps, structure_apps, created_by_id, created_by_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
      [teamId, date, startTime || null, location, raceType, discipline, products || null, method || null, structure || null, notes || null, productIds || null, structureIds || null, kickProductIds || null, tette || null, weatherId || null, productApps || null, structureApps || null, u.id, u.name || "Ukjent", new Date().toISOString()]
    );
    return res.json({ id: result.rows[0].id });
  });

  app.put("/api/race-preps/:id", requirePermission("raceprep", "edit"), async (req, res) => {
    const u = req.user as any;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team admin only" });
    const id = parseInt(req.params.id);
    const teamId = u.activeTeamId || u.teamId;
    const { date, startTime, location, raceType, discipline, products, method, structure, notes, productIds, structureIds, kickProductIds, tette, weatherId, productApps, structureApps } = req.body;
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE race_preps SET date=$1, start_time=$2, location=$3, race_type=$4, discipline=$5, products=$6, method=$7, structure=$8, notes=$9, product_ids=$10, structure_ids=$11, kick_product_ids=$12, tette=$13, weather_id=$14, product_apps=$15, structure_apps=$16 WHERE id=$17 AND team_id=$18`,
      [date, startTime || null, location, raceType, discipline, products || null, method || null, structure || null, notes || null, productIds || null, structureIds || null, kickProductIds || null, tette || null, weatherId || null, productApps || null, structureApps || null, id, teamId]
    );
    return res.json({ ok: true });
  });

  app.delete("/api/race-preps/:id", requirePermission("raceprep", "edit"), async (req, res) => {
    const u = req.user as any;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team admin only" });
    const id = parseInt(req.params.id);
    const teamId = u.activeTeamId || u.teamId;
    const { pool } = await import("./db");
    const snapP = await (pool as any).query(`SELECT * FROM race_preps WHERE id = $1 AND team_id = $2`, [id, teamId]);
    const snapPE = await (pool as any).query(`SELECT * FROM race_prep_entries WHERE race_prep_id = $1`, [id]);
    await (pool as any).query(`DELETE FROM race_prep_entries WHERE race_prep_id = $1`, [id]);
    const rDel = await (pool as any).query(`DELETE FROM race_preps WHERE id = $1 AND team_id = $2 RETURNING id`, [id, teamId]);
    if (rDel.rows.length) await recordDeletion(req, "race_prep", id, `Race prep deleted: ${snapP.rows[0]?.location ?? id} (${snapP.rows[0]?.date ?? ""})`, { prep: snapP.rows[0] ?? null, entries: snapPE.rows });
    return res.json({ ok: true });
  });

  // Helper: verify a race_prep row belongs to the active team. Returns the prep row or null.
  async function getRacePrepForTeam(id: number, teamId: number): Promise<{ id: number } | null> {
    const { pool: pgRp } = await import("./db");
    const r = await (pgRp as any).query(`SELECT id FROM race_preps WHERE id=$1 AND team_id=$2`, [id, teamId]);
    return r.rows.length ? r.rows[0] : null;
  }

  app.get("/api/race-preps/:id/entries", requirePermission("raceprep", "view"), async (req, res) => {
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const id = parseInt(req.params.id);
    if (!await getRacePrepForTeam(id, teamId)) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT id, race_prep_id AS "racePrepId", athlete_id AS "athleteId", athlete_name AS "athleteName",
              ski_id AS "skiId", ski_id_classic AS "skiIdClassic", ski_id_skating AS "skiIdSkating",
              borrowed_athlete_id AS "borrowedAthleteId", borrowed_athlete_id_classic AS "borrowedAthleteIdClassic",
              borrowed_athlete_id_skating AS "borrowedAthleteIdSkating",
              waxer_id AS "waxerId", waxer_name AS "waxerName", notes, created_at AS "createdAt"
       FROM race_prep_entries WHERE race_prep_id = $1 ORDER BY athlete_name ASC`,
      [id]
    );
    return res.json(result.rows);
  });

  // Skis available to borrow from other athletes for a race prep. Returns every
  // ski pair in the team (with its owning athlete's name) so a waxer can register
  // that an athlete is racing on a pair borrowed from a team-mate.
  app.get("/api/race-preps/:id/borrowable-skis", requirePermission("raceprep", "view"), async (req, res) => {
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const id = parseInt(req.params.id);
    if (!await getRacePrepForTeam(id, teamId)) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT rs.id, rs.athlete_id AS "athleteId", a.name AS "athleteName",
              rs.ski_id AS "skiId", rs.serial_number AS "serialNumber", rs.brand,
              rs.discipline, rs.construction, rs.mold, rs.base, rs.grind,
              rs.heights, rs.year, rs.custom_params AS "customParams"
       FROM race_skis rs
       JOIN athletes a ON a.id = rs.athlete_id
       WHERE a.team_id = $1 AND rs.archived_at IS NULL
       ORDER BY a.name ASC, rs.ski_id ASC`,
      [teamId]
    );
    return res.json(result.rows);
  });

  // ── Race-prep comments (waxer-private notes) ────────────────────────────
  // Each waxer can leave a private comment on a race prep. Only the comment's
  // author and Team Admins / Super Admins can see it.
  app.get("/api/race-preps/:id/comments", requireRaceprepOrRaceskis, async (req, res) => {
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const id = parseInt(req.params.id);
    if (!await getRacePrepForTeam(id, teamId)) return res.status(403).json({ message: "Forbidden" });
    const isAdmin = u.isTeamAdmin === 1 || u.isAdmin === 1;
    const { pool } = await import("./db");
    // Admins see all comments; regular waxers see only their own.
    const result = isAdmin
      ? await (pool as any).query(
          `SELECT id, race_prep_id AS "racePrepId", user_id AS "userId", user_name AS "userName", content, created_at AS "createdAt"
           FROM race_prep_comments WHERE race_prep_id = $1 AND team_id = $2 ORDER BY created_at ASC`,
          [id, teamId]
        )
      : await (pool as any).query(
          `SELECT id, race_prep_id AS "racePrepId", user_id AS "userId", user_name AS "userName", content, created_at AS "createdAt"
           FROM race_prep_comments WHERE race_prep_id = $1 AND team_id = $2 AND user_id = $3 ORDER BY created_at ASC`,
          [id, teamId, u.id]
        );
    return res.json(result.rows);
  });

  app.post("/api/race-preps/:id/comments", requireRaceprepOrRaceskis, async (req, res) => {
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const id = parseInt(req.params.id);
    if (!await getRacePrepForTeam(id, teamId)) return res.status(403).json({ message: "Forbidden" });
    const content = String(req.body.content ?? "").trim();
    if (!content || content.length > 2000) return res.status(400).json({ message: "Invalid comment" });
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `INSERT INTO race_prep_comments (race_prep_id, team_id, user_id, user_name, content, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, race_prep_id AS "racePrepId", user_id AS "userId", user_name AS "userName", content, created_at AS "createdAt"`,
      [id, teamId, u.id, u.name || "Unknown", content, new Date().toISOString()]
    );
    return res.json(result.rows[0]);
  });

  app.delete("/api/race-prep-comments/:id", requireRaceprepOrRaceskis, async (req, res) => {
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const commentId = parseInt(req.params.id);
    const isAdmin = u.isTeamAdmin === 1 || u.isAdmin === 1;
    const { pool } = await import("./db");
    const existing = await (pool as any).query(
      `SELECT user_id FROM race_prep_comments WHERE id = $1 AND team_id = $2`, [commentId, teamId]
    );
    if (!existing.rows.length) return res.status(404).json({ message: "Not found" });
    // Only the author or an admin may delete
    if (!isAdmin && existing.rows[0].user_id !== u.id) return res.status(403).json({ message: "Forbidden" });
    await (pool as any).query(`DELETE FROM race_prep_comments WHERE id = $1`, [commentId]);
    return res.json({ ok: true });
  });

  app.post("/api/race-preps/:id/entries", requirePermission("raceprep", "edit"), async (req, res) => {
    const u = req.user as any;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team admin only" });
    const teamId = u.activeTeamId || u.teamId;
    const racePrepId = parseInt(req.params.id);
    if (!await getRacePrepForTeam(racePrepId, teamId)) return res.status(403).json({ message: "Forbidden" });
    const { athleteId, athleteName } = req.body;
    if (!athleteId || !athleteName) return res.status(400).json({ message: "athleteId and athleteName required" });
    const { pool } = await import("./db");
    // Verify athlete belongs to same team
    const athRow = await (pool as any).query(`SELECT id FROM athletes WHERE id=$1 AND team_id=$2`, [athleteId, teamId]);
    if (!athRow.rows.length) return res.status(403).json({ message: "Athlete not in this team" });
    const existing = await (pool as any).query(
      `SELECT id FROM race_prep_entries WHERE race_prep_id=$1 AND athlete_id=$2`,
      [racePrepId, athleteId]
    );
    if (existing.rows.length > 0) return res.status(409).json({ message: "Already on start list" });
    const result = await (pool as any).query(
      `INSERT INTO race_prep_entries (race_prep_id, athlete_id, athlete_name, ski_id, waxer_id, waxer_name, notes, created_at)
       VALUES ($1,$2,$3,NULL,NULL,NULL,NULL,$4) RETURNING id`,
      [racePrepId, athleteId, athleteName, new Date().toISOString()]
    );
    return res.json({ id: result.rows[0].id });
  });

  // Editing an entry's ski IDs is an athlete-ski activity — allowed for anyone
  // with access to the athlete (ski-waxers work from the Race Skis area, which
  // doesn't require raceprep). Glide work is gated separately by raceprepGlide.
  // #5: a waxer enters/edits the athlete feedback for a race directly (after
  // talking to the runner) — separate from the public feedback link.
  app.patch("/api/race-preps/:id/entries/:eid/feedback", requireAuth, async (req, res) => {
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const prepId = parseInt(req.params.id);
    const eid = parseInt(req.params.eid);
    if (!await getRacePrepForTeam(prepId, teamId)) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const entryRes = await (pool as any).query(`SELECT athlete_id AS "athleteId", race_prep_id AS "racePrepId" FROM race_prep_entries WHERE id=$1`, [eid]);
    if (!entryRes.rows.length || entryRes.rows[0].racePrepId !== prepId) return res.status(404).json({ message: "Not found" });
    if (!canManageTeam(req)) {
      const hasAccess = await storage.hasAthleteAccess(entryRes.rows[0].athleteId, u.id, false, teamId);
      if (!hasAccess) return res.status(403).json({ message: "No access to this athlete" });
    }
    await (pool as any).query(
      `UPDATE race_prep_entries SET athlete_rating=$1, athlete_comment=$2 WHERE id=$3`,
      [req.body.athleteRating || null, req.body.athleteComment || null, eid]
    );
    return res.json({ ok: true });
  });

  app.put("/api/race-preps/:id/entries/:eid", requireAuth, async (req, res) => {
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    const prepId = parseInt(req.params.id);
    const eid = parseInt(req.params.eid);
    if (!await getRacePrepForTeam(prepId, teamId)) return res.status(403).json({ message: "Forbidden" });
    const { skiId, skiIdClassic, skiIdSkating, notes,
            borrowedAthleteId, borrowedAthleteIdClassic, borrowedAthleteIdSkating } = req.body;
    const { pool } = await import("./db");
    const entryRes = await (pool as any).query(
      `SELECT athlete_id AS "athleteId", race_prep_id AS "racePrepId" FROM race_prep_entries WHERE id=$1`, [eid]
    );
    if (!entryRes.rows.length) return res.status(404).json({ message: "Not found" });
    // Verify entry belongs to the same race prep
    if (entryRes.rows[0].racePrepId !== prepId) return res.status(403).json({ message: "Forbidden" });
    const isAdmin = u.isTeamAdmin === 1 || u.isAdmin === 1;
    // Anyone with access to the athlete may register their ski pair.
    if (!isAdmin) {
      const hasAccess = await storage.hasAthleteAccess(entryRes.rows[0].athleteId, u.id, false, teamId);
      if (!hasAccess) return res.status(403).json({ message: "No access to this athlete" });
    }
    // Borrowed-ski owner ids must reference athletes in the same team (a ski pair
    // belonging to another athlete that the waxer is using for this race).
    const normBorrow = async (v: any): Promise<number | null> => {
      const n = v != null && v !== "" ? parseInt(String(v)) : null;
      if (n == null || isNaN(n)) return null;
      const r = await (pool as any).query(`SELECT id FROM athletes WHERE id=$1 AND team_id=$2`, [n, teamId]);
      return r.rows.length ? n : null;
    };
    const bId = await normBorrow(borrowedAthleteId);
    const bClassic = await normBorrow(borrowedAthleteIdClassic);
    const bSkating = await normBorrow(borrowedAthleteIdSkating);
    // A pair replaced on an entry must lose ALL connection to the race: on
    // single-discipline races (everything except Skiathlon) exactly ONE slot
    // may hold a label — a stale value left in a sibling column made both the
    // old and the new pair count as raced.
    let vSingle = skiId != null ? String(skiId) : null;
    let vClassic = skiIdClassic != null ? String(skiIdClassic) : null;
    let vSkating = skiIdSkating != null ? String(skiIdSkating) : null;
    let vbId = bId, vbClassic = bClassic, vbSkating = bSkating;
    const prepRow = await (pool as any).query(`SELECT discipline FROM race_preps WHERE id=$1`, [prepId]);
    if (prepRow.rows[0]?.discipline !== "Skiathlon") {
      vSingle = vSingle ?? vClassic ?? vSkating;
      vbId = vbId ?? vbClassic ?? vbSkating;
      vClassic = null; vSkating = null; vbClassic = null; vbSkating = null;
    }
    await (pool as any).query(
      `UPDATE race_prep_entries SET ski_id=$1, ski_id_classic=$2, ski_id_skating=$3, waxer_id=$4, waxer_name=$5, notes=$6,
              borrowed_athlete_id=$8, borrowed_athlete_id_classic=$9, borrowed_athlete_id_skating=$10 WHERE id=$7`,
      [vSingle, vClassic, vSkating, u.id, u.name || "Ukjent", notes || null, eid, vbId, vbClassic, vbSkating]
    );
    return res.json({ ok: true });
  });

  app.delete("/api/race-preps/:id/entries/:eid", requirePermission("raceprep", "edit"), async (req, res) => {
    const u = req.user as any;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team admin only" });
    const teamId = u.activeTeamId || u.teamId;
    const prepId = parseInt(req.params.id);
    const eid = parseInt(req.params.eid);
    if (!await getRacePrepForTeam(prepId, teamId)) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const snapE1 = await (pool as any).query(`SELECT * FROM race_prep_entries WHERE id=$1 AND race_prep_id=$2`, [eid, prepId]);
    // Verify entry belongs to this race prep before deleting
    const rDel = await (pool as any).query(`DELETE FROM race_prep_entries WHERE id=$1 AND race_prep_id=$2 RETURNING id`, [eid, prepId]);
    if (rDel.rows.length) await recordDeletion(req, "race_prep_entry", eid, `Race prep entry deleted: ${snapE1.rows[0]?.athlete_name ?? eid}`, snapE1.rows[0] ?? null);
    return res.json({ ok: true });
  });

  // Athlete race history lives in the Race Skis area — gated by raceskis, not
  // raceprep, so ski-waxers (no Race Prep zone access) can still see and register
  // ski pairs for their athletes.
  app.get("/api/athletes/:id/race-history", requirePermission("raceskis", "view"), async (req, res) => {
    const athleteId = parseInt(req.params.id);
    const u = req.user as any;
    const teamId = u.activeTeamId || u.teamId;
    // Athlete access users may only view their own linked athlete
    if (u.isAthleteAccess === 1 && !(await storage.hasAthleteAccess(athleteId, u.id, false, teamId))) return res.status(403).json({ message: "Forbidden" });
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT
         rpe.id AS "entryId",
         rpe.ski_id AS "skiId",
         rpe.ski_id_classic AS "skiIdClassic",
         rpe.ski_id_skating AS "skiIdSkating",
         rpe.waxer_id AS "waxerId",
         rpe.waxer_name AS "waxerName",
         rpe.notes AS "entryNotes",
         rp.id AS "racePrepId",
         rp.date,
         rp.location,
         rp.race_type AS "raceType",
         rp.discipline,
         rp.product_ids AS "productIds",
         rp.structure_ids AS "structureIds",
         rp.kick_product_ids AS "kickProductIds",
         rp.product_apps AS "productApps",
         rp.structure_apps AS "structureApps",
         rp.tette,
         rp.method,
         rp.notes AS "prepNotes",
         rp.weather_id AS "weatherId",
         rp.start_time AS "startTime",
         rpe.athlete_rating AS "athleteRating",
         rpe.athlete_comment AS "athleteComment",
         rpe.borrowed_athlete_id AS "borrowedAthleteId",
         rpe.borrowed_athlete_id_classic AS "borrowedAthleteIdClassic",
         rpe.borrowed_athlete_id_skating AS "borrowedAthleteIdSkating"
       FROM race_prep_entries rpe
       JOIN race_preps rp ON rpe.race_prep_id = rp.id
       WHERE rpe.athlete_id = $1 AND rp.team_id = $2
       ORDER BY rp.date DESC`,
      [athleteId, teamId]
    );
    // Athlete-access users see no wax data at all. Ski-waxers (no raceprepGlide)
    // see kick/binder but not the glide/structure work. Admins & glide-waxers see all.
    let rows = result.rows;
    if (u.isAthleteAccess === 1) {
      rows = rows.map((r: any) => ({
        ...r,
        productIds: undefined, structureIds: undefined, kickProductIds: undefined,
        productApps: undefined, structureApps: undefined, method: undefined, prepNotes: undefined,
      }));
    } else if (!canSeeRacePrepGlide(req)) {
      rows = rows.map((r: any) => ({
        ...r,
        productIds: undefined, structureIds: undefined,
        productApps: undefined, structureApps: undefined, method: undefined,
      }));
    }
    return res.json(rows);
  });

  app.post("/api/race-skis/:id/archive", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.archiveRaceSki(id);
    res.json(updated);
  });

  app.post("/api/race-skis/:id/restore", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.restoreRaceSki(id);
    res.json(updated);
  });

  app.delete("/api/race-skis/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    if (!ski.archivedAt) {
      return res.status(400).json({ message: "Ski must be archived before permanent deletion" });
    }
    await storage.deleteRaceSki(id);
    await recordDeletion(req, "race_ski", id, `Race ski deleted: ${ski.skiId}${ski.brand ? ` (${ski.brand})` : ""}`, ski);
    res.json({ ok: true });
  });

  // --- Race Ski Regrinds ---
  // Keep a ski's "current grind" equal to its most recent regrind (by date) so
  // the garage always shows the LATEST grind, not the original (#20). Falls back
  // to leaving the value untouched when no regrinds remain.
  async function syncSkiGrindToLatestRegrind(skiId: number) {
    try {
      const { pool } = await import("./db");
      const r = await (pool as any).query(
        `SELECT grind_type FROM race_ski_regrinds WHERE race_ski_id = $1
         ORDER BY date DESC NULLS LAST, id DESC LIMIT 1`, [skiId]
      );
      if (r.rows.length && r.rows[0].grind_type) {
        await storage.updateRaceSki(skiId, { grind: r.rows[0].grind_type });
      }
    } catch (e) { /* non-fatal */ }
  }

  app.get("/api/race-skis/:id/regrinds", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const list = await storage.listRaceSkiRegrinds(id);
    res.json(list);
  });

  app.post("/api/race-skis/:id/regrinds", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const now = new Date().toISOString();
    const regrind = await storage.createRaceSkiRegrind({
      raceSkiId: id,
      date: req.body.date,
      grindType: req.body.grindType,
      stone: req.body.stone || null,
      pattern: req.body.pattern || null,
      notes: req.body.notes || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
    });
    await syncSkiGrindToLatestRegrind(id);
    res.json(regrind);
  });

  app.delete("/api/race-ski-regrinds/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const regrind = await storage.getRaceSkiRegrind(id);
    if (!regrind) return res.status(404).json({ message: "Not found" });
    const ski = await storage.getRaceSki(regrind.raceSkiId);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await canTouchRaceSki(ski, req, u);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteRaceSkiRegrind(id);
    await syncSkiGrindToLatestRegrind(regrind.raceSkiId);
    res.json({ ok: true });
  });

  // --- Test Ski Regrinds ---
  app.get("/api/series/:id/regrinds", requirePermission("testskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const series = await storage.getSeries(id);
    if (!series) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(series, req)) return res.status(403).json({ message: "Forbidden" });
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, series.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const list = await storage.listTestSkiRegrinds(id);
    res.json(list);
  });

  app.post("/api/series/:id/regrinds", requirePermission("testskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const series = await storage.getSeries(id);
    if (!series) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(series, req)) return res.status(403).json({ message: "Forbidden" });
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, series.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const now = new Date().toISOString();
    const regrind = await storage.createTestSkiRegrind({
      seriesId: id,
      date: req.body.date,
      grindType: req.body.grindType,
      stone: req.body.stone || null,
      pattern: req.body.pattern || null,
      notes: req.body.notes || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
    });
    await storage.updateSeries(id, { grind: req.body.grindType, lastRegrind: req.body.date });
    res.json(regrind);
  });

  app.delete("/api/test-ski-regrinds/:id", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    // Verify the regrind belongs to a series owned by this team
    const check = await (pool as any).query(
      `SELECT tsr.id FROM test_ski_regrinds tsr
       JOIN test_ski_series tss ON tss.id = tsr.series_id
       WHERE tsr.id = $1 AND tss.team_id = $2`,
      [id, teamId]
    );
    if (!check.rows.length) return res.status(404).json({ message: "Not found" });
    const deleted = await storage.deleteTestSkiRegrind(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // --- Runsheets CRUD ---

  app.get("/api/runsheets", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    const items = await storage.listRunsheets(teamId);
    // The test behind the runsheet, and the conditions it was run in. A runsheet
    // without the weather it belongs to is only half the documentation.
    const ids = items.map((x: any) => x.testId).filter(Boolean);
    if (ids.length) {
      try {
        const { pool: pgR } = await import("./db");
        const r = await (pgR as any).query(
          `SELECT t.id, t.date, t.location, t.test_name AS "testName", t.test_type AS "testType",
                  t.created_by_name AS "createdByName",
                  w.air_temperature_c AS "airTemperatureC", w.snow_temperature_c AS "snowTemperatureC",
                  w.snow_type AS "snowType",
                  (SELECT COUNT(*)::int FROM test_entries e WHERE e.test_id = t.id) AS "entryCount",
                  (SELECT COUNT(*)::int FROM test_entries e WHERE e.test_id = t.id
                     AND (e.result_0km_cm_behind IS NOT NULL OR e.rank_0km IS NOT NULL)) AS "resultCount"
           FROM tests t LEFT JOIN daily_weather w ON w.id = t.weather_id
           WHERE t.id = ANY($1::int[]) AND t.team_id = $2`, [ids, teamId]);
        const m = new Map(r.rows.map((x: any) => [x.id, x]));
        for (const it of items as any[]) it.test = m.get(it.testId) ?? null;
      } catch (e) { console.error("[runsheets] test context failed:", e); }
    }
    res.json(items);
  });

  app.post("/api/runsheets", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { testId, label } = req.body;
    if (!testId || !label) return res.status(400).json({ message: "testId and label required" });
    const rsTest = await storage.getTest(Number(testId));
    if (!rsTest || !verifyTeamOwnership(rsTest, req)) return res.status(403).json({ message: "Forbidden" });
    const existing = await storage.getRunsheetByTestId(testId, teamId);
    if (existing) return res.status(409).json({ message: "This test already has a runsheet" });
    const created = await storage.createRunsheet({
      testId,
      label,
      createdAt: new Date().toISOString(),
      createdById: u.id,
      teamId,
    });
    res.status(201).json(created);
  });

  app.delete("/api/runsheets/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getRunsheet(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteRunsheet(id);
    res.json({ ok: true });
  });

  // --- Runsheet Watch Sessions (in-memory) ---

  type WatchHeat = { pairA: number | null; pairB: number | null; distA: string; distB: string };
  type WatchSession = {
    code: string;
    skiPairs: number[];
    skiLabels: Record<number, string>;
    bracket: WatchHeat[][];
    createdAt: number;
    userId: number;
    userName: string;         // test creator / person who added to queue
    operatorName?: string;    // person logged in on the watch device
    testId: number | null;
    testInfo: { date: string; location: string; testType: string } | null;
    teamId: number;
  };

  // In-memory fallback if DB table doesn't exist yet
  const watchSessionsMemory = new Map<string, WatchSession>();

  // Simple brute-force protection: track failed code lookups per IP
  const watchCodeFailures = new Map<string, { count: number; resetAt: number }>();
  const WATCH_MAX_FAILURES = 10;
  const WATCH_FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5-minute window

  // Periodisk opprydding av utløpte oppføringer — hindrer ubegrenset vekst
  const watchCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of watchCodeFailures.entries()) {
      if (now > entry.resetAt) watchCodeFailures.delete(ip);
    }
    for (const [code, session] of watchSessionsMemory.entries()) {
      // Fjern sesjoner eldre enn 24 timer
      if (now - new Date(session.createdAt).getTime() > 24 * 3600 * 1000) {
        watchSessionsMemory.delete(code);
      }
    }
  }, 10 * 60 * 1000); // kjør hvert 10. minutt
  // Rydd opp ved prosessavslutning
  process.once("SIGTERM", () => clearInterval(watchCleanupInterval));

  function watchRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = watchCodeFailures.get(ip);
    if (!entry || now > entry.resetAt) {
      watchCodeFailures.set(ip, { count: 1, resetAt: now + WATCH_FAILURE_WINDOW_MS });
      return false; // not rate-limited
    }
    entry.count++;
    return entry.count > WATCH_MAX_FAILURES;
  }
  function watchResetFailures(ip: string) { watchCodeFailures.delete(ip); }
  // Coarser limiter for the unauthenticated PIN endpoints: normal watch usage
  // stays far below it, PIN enumeration cannot.
  const watchPinHits = new Map<string, { count: number; resetAt: number }>();
  function watchPinRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = watchPinHits.get(ip);
    if (!entry || now > entry.resetAt) {
      watchPinHits.set(ip, { count: 1, resetAt: now + WATCH_FAILURE_WINDOW_MS });
      return false;
    }
    entry.count++;
    return entry.count > 120;
  }

  async function generateSessionCode(): Promise<string> {
    // The Garmin app enters exactly 4 digits, so the length is fixed — but a
    // colliding code would silently take over another session via upsert, so
    // retry until the code is free.
    const { pool } = await import("./db");
    for (let i = 0; i < 15; i++) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const existing = await (pool as any).query(`SELECT 1 FROM watch_sessions WHERE code = $1`, [code]).catch(() => ({ rows: [] }));
      if (existing.rows.length === 0) return code;
    }
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  async function getWatchSession(code: string): Promise<WatchSession | null> {
    // Try DB first, fall back to memory
    try {
      const rows = await db.select().from(watchSessions).where(eq(watchSessions.code, code));
      if (rows.length > 0) {
        const row = rows[0];
        if (new Date(row.expiresAt) < new Date()) {
          await db.delete(watchSessions).where(eq(watchSessions.code, code)).catch(() => {});
          return null;
        }
        return {
          code: row.code,
          skiPairs: JSON.parse(row.skiPairs),
          skiLabels: row.skiLabels ? JSON.parse(row.skiLabels) : {},
          bracket: JSON.parse(row.bracket),
          createdAt: new Date(row.createdAt).getTime(),
          userId: row.userId,
          userName: row.userName,
          operatorName: (row as any).operatorName ?? undefined,
          testId: row.testId ?? null,
          testInfo: null,
          teamId: row.teamId ?? 0,
        };
      }
    } catch (_) {}
    // Fall back to memory
    return watchSessionsMemory.get(code) ?? null;
  }

  async function saveWatchSession(session: WatchSession): Promise<void> {
    // Save to memory always (instant)
    watchSessionsMemory.set(session.code, session);
    // Also try DB
    try {
      const labelsJson = JSON.stringify(session.skiLabels ?? {});
      await db.insert(watchSessions).values({
        code: session.code,
        skiPairs: JSON.stringify(session.skiPairs),
        skiLabels: labelsJson,
        bracket: JSON.stringify(session.bracket),
        testId: session.testId ?? null,
        userId: session.userId,
        userName: session.userName,
        operatorName: session.operatorName ?? null,
        teamId: session.teamId ?? null,
        createdAt: new Date(session.createdAt).toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).onConflictDoUpdate({
        target: watchSessions.code,
        set: { bracket: JSON.stringify(session.bracket), skiLabels: labelsJson, operatorName: session.operatorName ?? null },
      });
    } catch (_) {}
  }

  async function updateWatchBracket(code: string, bracket: WatchHeat[][]): Promise<void> {
    // Update memory
    const mem = watchSessionsMemory.get(code);
    if (mem) mem.bracket = bracket;
    // Also try DB
    try {
      await db.update(watchSessions).set({ bracket: JSON.stringify(bracket) }).where(eq(watchSessions.code, code));
    } catch (_) {}
  }

  async function deleteWatchSession(code: string): Promise<void> {
    watchSessionsMemory.delete(code);
    try {
      await db.delete(watchSessions).where(eq(watchSessions.code, code));
    } catch (_) {}
  }

  // Helper: build skiLabels for a watch session — handles both race skis and test ski series
  async function getSkiLabelsForTest(testId: number | null | undefined): Promise<Record<number, string>> {
    if (!testId) return {};
    try {
      // Fetch the test to know the ski source and seriesId
      const testRows = await db.select({ testSkiSource: tests.testSkiSource, seriesId: tests.seriesId })
        .from(tests).where(eq(tests.id, testId));
      const test = testRows[0];
      if (!test) return {};

      if (test.testSkiSource === "raceskis") {
        // Race ski test: label = serialNumber (3-digit) or skiId per entry
        const entries = await db.select({ skiNumber: testEntries.skiNumber, raceSkiId: testEntries.raceSkiId })
          .from(testEntries).where(eq(testEntries.testId, testId));
        const raceSkiIds = entries.map(e => e.raceSkiId).filter((id): id is number => id != null);
        if (raceSkiIds.length === 0) return {};
        const skis = await db.select({ id: raceSkis.id, serialNumber: raceSkis.serialNumber, skiId: raceSkis.skiId })
          .from(raceSkis).where(inArray(raceSkis.id, raceSkiIds));
        const skiById = new Map(skis.map(s => [s.id, s]));
        const labels: Record<number, string> = {};
        for (const entry of entries) {
          if (entry.raceSkiId) {
            const ski = skiById.get(entry.raceSkiId);
            if (ski) labels[entry.skiNumber] = ski.serialNumber || ski.skiId;
          }
        }
        return labels;
      }

      // Regular test ski series: use pairLabels
      if (!test.seriesId) return {};
      const seriesRows = await db.select({ pairLabels: testSkiSeries.pairLabels })
        .from(testSkiSeries).where(eq(testSkiSeries.id, test.seriesId));
      const raw = seriesRows[0]?.pairLabels;
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return {};
      const labels: Record<number, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" && v.trim()) labels[Number(k)] = v.trim();
      }
      return labels;
    } catch { return {}; }
  }

  function watchInitBracket(pairs: number[]): WatchHeat[][] {
    if (pairs.length < 2) return [];
    const totalRounds = Math.ceil(Math.log2(pairs.length));
    const rounds: WatchHeat[][] = [];
    const firstRound: WatchHeat[] = [];
    for (let i = 0; i < pairs.length; i += 2) {
      firstRound.push({ pairA: pairs[i], pairB: i + 1 < pairs.length ? pairs[i + 1] : null, distA: "", distB: "" });
    }
    rounds.push(firstRound);
    let prevCount = firstRound.length;
    for (let r = 1; r < totalRounds; r++) {
      const numHeats = Math.ceil(prevCount / 2);
      const round: WatchHeat[] = [];
      for (let h = 0; h < numHeats; h++) round.push({ pairA: null, pairB: null, distA: "", distB: "" });
      rounds.push(round);
      prevCount = numHeats;
    }
    for (let r = 0; r < rounds.length - 1; r++) {
      for (let h = 0; h < rounds[r].length; h++) {
        const heat = rounds[r][h];
        const byeWinner = (heat.pairA !== null && heat.pairB === null) ? heat.pairA
          : (heat.pairB !== null && heat.pairA === null) ? heat.pairB : null;
        if (byeWinner !== null) {
          const nh = Math.floor(h / 2);
          const ns = h % 2 === 0 ? "A" : "B";
          if (rounds[r + 1]?.[nh]) {
            if (ns === "A") rounds[r + 1][nh].pairA = byeWinner;
            else rounds[r + 1][nh].pairB = byeWinner;
          }
        }
      }
    }
    return rounds;
  }

  function watchGetWinner(heat: WatchHeat): number | null {
    if (heat.pairA !== null && heat.pairB === null) return heat.pairA;
    if (heat.pairB !== null && heat.pairA === null) return heat.pairB;
    if (heat.pairA === null || heat.pairB === null) return null;
    const dA = parseFloat(heat.distA), dB = parseFloat(heat.distB);
    if (isNaN(dA) || isNaN(dB)) return null;
    if (dA === 0 && dB > 0) return heat.pairA;
    if (dB === 0 && dA > 0) return heat.pairB;
    return null;
  }

  function watchRebuildDownstream(bracket: WatchHeat[][], fromRound: number) {
    for (let r = fromRound; r < bracket.length; r++) {
      for (const heat of bracket[r]) { heat.pairA = null; heat.pairB = null; heat.distA = ""; heat.distB = ""; }
    }
    for (let r = Math.max(0, fromRound - 1); r < bracket.length - 1; r++) {
      for (let h = 0; h < bracket[r].length; h++) {
        const w = watchGetWinner(bracket[r][h]);
        if (w === null) continue;
        const nh = Math.floor(h / 2), ns = h % 2 === 0 ? "A" : "B";
        if (!bracket[r + 1]?.[nh]) continue;
        if (ns === "A") bracket[r + 1][nh].pairA = w; else bracket[r + 1][nh].pairB = w;
      }
    }
  }

  function watchFindCurrentHeat(bracket: WatchHeat[][]): { roundIndex: number; heatIndex: number; roundName: string; pairA: number; pairB: number } | null {
    const totalRounds = bracket.length;
    for (let r = 0; r < bracket.length; r++) {
      for (let h = 0; h < bracket[r].length; h++) {
        const heat = bracket[r][h];
        if (heat.pairA !== null && heat.pairB !== null && watchGetWinner(heat) === null) {
          const fromEnd = totalRounds - 1 - r;
          const name = fromEnd === 0 ? "Final" : fromEnd === 1 ? "Semi-final" : fromEnd === 2 ? "Quarter-final" : `Round ${r + 1}`;
          return { roundIndex: r, heatIndex: h, roundName: name, pairA: heat.pairA, pairB: heat.pairB };
        }
      }
    }
    return null;
  }

  function watchCalcDiffs(bracket: WatchHeat[][]): Map<number, number> {
    const diffs = new Map<number, number>();
    for (let r = bracket.length - 1; r >= 0; r--) {
      for (const heat of bracket[r]) {
        if (heat.pairA === null || heat.pairB === null) continue;
        const dA = parseFloat(heat.distA), dB = parseFloat(heat.distB);
        if (isNaN(dA) || isNaN(dB)) continue;
        if (dA === 0 && dB > 0) {
          if (!diffs.has(heat.pairA)) diffs.set(heat.pairA, 0);
          diffs.set(heat.pairB, dB + (diffs.get(heat.pairA) ?? 0));
        } else if (dB === 0 && dA > 0) {
          if (!diffs.has(heat.pairB)) diffs.set(heat.pairB, 0);
          diffs.set(heat.pairA, dA + (diffs.get(heat.pairB) ?? 0));
        }
      }
    }
    return diffs;
  }

  app.post("/api/runsheet/sessions", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const { skiPairs, testId, skiLabels } = req.body;
    if (!Array.isArray(skiPairs) || skiPairs.length < 2) {
      return res.status(400).json({ message: "Need at least 2 ski pairs" });
    }
    const teamId = getActiveTeamId(req);
    if (testId) {
      const sTest = await storage.getTest(Number(testId));
      if (!sTest || (sTest as any).teamId !== teamId) return res.status(403).json({ message: "Forbidden" });
    }
    const code = await generateSessionCode();
    const session: WatchSession = {
      code,
      skiPairs: skiPairs.map(Number),
      skiLabels: skiLabels && typeof skiLabels === "object" ? skiLabels : {},
      bracket: watchInitBracket(skiPairs.map(Number)),
      createdAt: Date.now(),
      userId: u.id,
      userName: u.name,
      testId: testId ? Number(testId) : null,
      testInfo: null,
      teamId,
    };
    await saveWatchSession(session);
    res.json({ code, bracket: session.bracket });
  });

  app.get("/api/runsheet/sessions/:code", requireAuth, async (req, res) => {
    const session = await getWatchSession(req.params.code as string);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const u = userInfo(req);
    if (session.userId !== u.id && !(u.isScopeAdmin && (session as any).teamId === getActiveTeamId(req))) return res.status(403).json({ message: "Forbidden" });
    const currentHeat = watchFindCurrentHeat(session.bracket);
    const diffs = watchCalcDiffs(session.bracket);
    const results = [...diffs.entries()].sort((a, b) => a[1] - b[1]).map(([ski, diff], i, arr) => {
      let rank = 1;
      for (let j = 0; j < i; j++) { if (arr[j][1] < diff) rank = j + 2; }
      return { skiNumber: ski, diff, rank };
    });
    res.json({ bracket: session.bracket, currentHeat, results, skiPairs: session.skiPairs, complete: !currentHeat && results.length === session.skiPairs.length });
  });

  app.get("/api/runsheet/watch/:code", async (req, res) => {
    const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown");
    if (watchRateLimit(ip)) return res.status(429).json({ message: "Too many attempts. Try again in 5 minutes." });
    const code = req.params.code as string;
    const session = await getWatchSession(code);
    if (!session) return res.status(404).json({ message: "Invalid code" });
    watchResetFailures(ip);
    const labels = session.skiLabels ?? {};
    const currentHeat = watchFindCurrentHeat(session.bracket);
    const diffs = watchCalcDiffs(session.bracket);
    const complete = !currentHeat && diffs.size === session.skiPairs.length;
    let champion: number | null = null;
    if (complete) {
      const sorted = [...diffs.entries()].sort((a, b) => a[1] - b[1]);
      if (sorted.length > 0) champion = sorted[0][0];
    }
    const labeledHeat = currentHeat ? {
      ...currentHeat,
      labelA: currentHeat.pairA !== null ? (labels[currentHeat.pairA] ?? String(currentHeat.pairA)) : null,
      labelB: currentHeat.pairB !== null ? (labels[currentHeat.pairB] ?? String(currentHeat.pairB)) : null,
    } : null;
    res.json({ currentHeat: labeledHeat, complete, champion, totalPairs: session.skiPairs.length });
  });

  app.post("/api/runsheet/watch/:code/result", async (req, res) => {
    const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown");
    if (watchRateLimit(ip)) return res.status(429).json({ message: "Too many attempts. Try again in 5 minutes." });
    const code = req.params.code as string;
    const session = await getWatchSession(code);
    if (!session) return res.status(404).json({ message: "Invalid code" });
    watchResetFailures(ip);
    const { roundIndex, heatIndex, winnerPair, loserDistance } = req.body;
    if (typeof roundIndex !== "number" || typeof heatIndex !== "number" || typeof winnerPair !== "number" || typeof loserDistance !== "number") {
      return res.status(400).json({ message: "Missing fields" });
    }
    if (!Number.isFinite(loserDistance) || loserDistance < 1 || loserDistance > 999 || loserDistance !== Math.floor(loserDistance)) {
      return res.status(400).json({ message: "Distance must be integer 1-999" });
    }
    if (roundIndex < 0 || roundIndex >= session.bracket.length) return res.status(400).json({ message: "Invalid round" });
    if (heatIndex < 0 || heatIndex >= session.bracket[roundIndex].length) return res.status(400).json({ message: "Invalid heat" });
    const heat = session.bracket[roundIndex][heatIndex];
    if (!heat || heat.pairA === null || heat.pairB === null) {
      return res.status(400).json({ message: "Invalid heat" });
    }
    if (heat.pairA !== winnerPair && heat.pairB !== winnerPair) {
      return res.status(400).json({ message: "Winner not in this heat" });
    }
    if (heat.pairA === winnerPair) {
      heat.distA = "0";
      heat.distB = String(loserDistance);
    } else {
      heat.distB = "0";
      heat.distA = String(loserDistance);
    }
    watchRebuildDownstream(session.bracket, roundIndex + 1);
    await updateWatchBracket(code, session.bracket);
    const nextHeat = watchFindCurrentHeat(session.bracket);
    const sessionLabels = session.skiLabels ?? {};
    const labeledNext = nextHeat ? {
      ...nextHeat,
      labelA: nextHeat.pairA !== null ? (sessionLabels[nextHeat.pairA] ?? String(nextHeat.pairA)) : null,
      labelB: nextHeat.pairB !== null ? (sessionLabels[nextHeat.pairB] ?? String(nextHeat.pairB)) : null,
    } : null;
    res.json({ ok: true, nextHeat: labeledNext });
  });

  app.post("/api/runsheet/sessions/:code/apply", async (req, res) => {
    const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown");
    if (watchRateLimit(ip)) return res.status(429).json({ message: "Too many attempts. Try again in 5 minutes." });
    const session = await getWatchSession(req.params.code as string);
    if (!session) return res.status(404).json({ message: "Invalid code" });
    watchResetFailures(ip);
    if (!session.testId) return res.status(400).json({ message: "No test linked to this session" });

    const diffs = watchCalcDiffs(session.bracket);
    if (diffs.size === 0) return res.status(400).json({ message: "No results yet" });

    const sorted = [...diffs.entries()].sort((a, b) => a[1] - b[1]);
    const results: { skiNumber: number; diff: number; rank: number }[] = [];
    let prevDiff: number | null = null;
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      const [skiNumber, diff] = sorted[i];
      if (prevDiff !== null && diff !== prevDiff) currentRank = i + 1;
      results.push({ skiNumber, diff, rank: currentRank });
      prevDiff = diff;
    }

    const entries = await storage.listEntries(session.testId);
    const entryBySkiNumber = new Map(entries.map((e: any) => [e.skiNumber, e]));
    for (const r of results) {
      const entry = entryBySkiNumber.get(r.skiNumber);
      if (!entry) continue;
      await storage.updateEntryResults((entry as any).id, r.diff, r.rank);
    }

    await db.update(tests)
      .set({
        runsheetBracket: JSON.stringify(session.bracket),
        watchOperatorName: session.operatorName ?? null,
      })
      .where(eq(tests.id, session.testId));

    res.json({ ok: true, applied: results.length });
  });

  app.delete("/api/runsheet/sessions/:code", requireAuth, async (req, res) => {
    const session = await getWatchSession(req.params.code as string);
    if (session) {
      const u = userInfo(req);
      if (session.userId !== u.id && !(u.isScopeAdmin && (session as any).teamId === getActiveTeamId(req))) return res.status(403).json({ message: "Forbidden" });
    }
    await deleteWatchSession(req.params.code as string);
    res.json({ ok: true });
  });

  setInterval(async () => {
    try {
      await db.delete(watchSessions).where(sql`expires_at < NOW()`);
    } catch (_) {}
  }, 60 * 60 * 1000);

  // --- DB-based Suggestions ---
  app.post("/api/suggestions", requirePermission("suggestions", "view"), async (req, res) => {
    const u = userInfo(req);
    const { snowTemperatureC, airTemperatureC, snowHumidityPct, airHumidityPct,
      artificialSnow, naturalSnow, grainSize, snowHumidityType, trackHardness, testType } = req.body;

    try {
      const teamId = getActiveTeamId(req);
      const allTests = await storage.listTests(u.groupScope, u.isScopeAdmin, teamId);
      const allWeather = await storage.listWeather(u.groupScope, u.isScopeAdmin, teamId);
      const products = await storage.listProducts(u.groupScope, u.isScopeAdmin, teamId);
      const weatherMap = new Map(allWeather.map((w) => [w.id, w]));
      const productMap = new Map(products.map((p) => [p.id, p]));

      // Include tests with weather linked first; fall back to all tests if needed
      const weatherLinkedTests = allTests.filter((t) => {
        if (testType && t.testType !== testType) return false;
        return t.weatherId && weatherMap.has(t.weatherId);
      });
      // Also keep tests without weather for the "no weather data" fallback
      const allTypeFilteredTests = allTests.filter((t) => {
        if (testType && t.testType !== testType) return false;
        return true;
      });

      function weatherSimilarity(w: any): number {
        let score = 0;
        // Temperature — most important signal (max 18 pts)
        const snowTDiff = Math.abs((w.snowTemperatureC ?? 0) - (snowTemperatureC ?? 0));
        const airTDiff  = Math.abs((w.airTemperatureC  ?? 0) - (airTemperatureC  ?? 0));
        score += Math.max(0, 10 - snowTDiff * 2);   // 0–10 pts
        score += Math.max(0, 8  - airTDiff  * 1.5); // 0–8 pts
        // Humidity (max 9 pts)
        const snowHDiff = Math.abs((w.snowHumidityPct ?? 50) - (snowHumidityPct ?? 50));
        const airHDiff  = Math.abs((w.airHumidityPct  ?? 50) - (airHumidityPct  ?? 50));
        score += Math.max(0, 5 - snowHDiff / 10);
        score += Math.max(0, 4 - airHDiff  / 10);
        // Categorical fields (max 15 pts)
        if (artificialSnow && w.artificialSnow) score += 6;
        if (naturalSnow && w.naturalSnow === naturalSnow) score += 6;
        if (grainSize && w.grainSize === grainSize) score += 3;
        if (snowHumidityType && w.snowHumidityType === snowHumidityType) score += 3;
        if (trackHardness && w.trackHardness === trackHardness) score += 3;
        return score;
      }

      // Helper: extract the best rank from an entry (supports both old rank0km and new results JSON)
      function extractBestRank(entry: any): number | null {
        // Try new multi-round results array first
        if (entry.results) {
          try {
            const rounds: { result?: number | null; rank?: number | null }[] = JSON.parse(entry.results);
            const ranks = rounds.map((r) => r.rank).filter((r) => r != null && r > 0) as number[];
            if (ranks.length > 0) return Math.min(...ranks);
          } catch {}
        }
        // Fall back to legacy columns
        const r0 = entry.rank0km;
        const rX = entry.rankXkm;
        if (r0 != null && r0 > 0) return r0;
        if (rX != null && rX > 0) return rX;
        return null;
      }

      // Score all tests that have weather data
      const scoredTests: { test: any; weather: any; similarity: number }[] = [];
      for (const test of weatherLinkedTests) {
        const weather = weatherMap.get(test.weatherId!);
        if (!weather) continue;
        const similarity = weatherSimilarity(weather);
        scoredTests.push({ test, weather, similarity });
      }
      scoredTests.sort((a, b) => b.similarity - a.similarity);

      // Tiered matching — progressive fallback so we always try to return something useful
      // Thresholds: perfect temp match ≈ 18 pts, so HIGH=16 catches "almost perfect temp"
      const HIGH_SIM = 16;
      const MED_SIM  = 8;
      const LOW_SIM  = 2;  // any temperature overlap at all

      const highMatches = scoredTests.filter((t) => t.similarity >= HIGH_SIM);
      const medMatches  = scoredTests.filter((t) => t.similarity >= MED_SIM);
      const lowMatches  = scoredTests.filter((t) => t.similarity >= LOW_SIM);

      let selectedTests: typeof scoredTests;
      let tierConfidence: "High" | "Medium" | "Low";
      let matchDescription: string;
      let noWeatherFallback = false;

      if (highMatches.length >= 1) {
        selectedTests = highMatches;
        tierConfidence = "High";
        matchDescription = "Very similar conditions in test history.";
      } else if (medMatches.length >= 1) {
        selectedTests = medMatches;
        tierConfidence = "Medium";
        matchDescription = "Moderately similar conditions in test history.";
      } else if (lowMatches.length >= 1) {
        selectedTests = lowMatches;
        tierConfidence = "Low";
        matchDescription = "Limited similar data — treat with caution.";
      } else if (scoredTests.length >= 1) {
        // Have weather-linked tests but none match — show the closest ones
        selectedTests = scoredTests.slice(0, 20);
        tierConfidence = "Low";
        matchDescription = "No closely matching conditions found. Showing best available data.";
      } else if (allTypeFilteredTests.length >= 1) {
        // No weather data at all — fall back to all tests of this type
        selectedTests = allTypeFilteredTests.map((t) => ({ test: t, weather: null, similarity: 0 }));
        tierConfidence = "Low";
        matchDescription = "No weather data linked to tests. Showing overall product performance.";
        noWeatherFallback = true;
      } else {
        return res.json({ suggestions: [{ title: "No data", description: "No test data found for this test type. Run some tests first to build recommendations.", products: [], confidence: "Low" }] });
      }

      // Aggregate product stats from the selected tests
      const productStats = new Map<number, { totalRank: number; count: number; wins: number }>();
      for (const { test } of selectedTests.slice(0, 200)) {
        const entries = await storage.listEntries(test.id);
        if (entries.length === 0) continue;
        for (const entry of entries) {
          if (!entry.productId) continue;
          const rank = extractBestRank(entry);
          if (rank == null) continue; // skip entries with no ranking data
          const stats = productStats.get(entry.productId) || { totalRank: 0, count: 0, wins: 0 };
          stats.totalRank += rank;
          stats.count += 1;
          if (rank === 1) stats.wins += 1;
          productStats.set(entry.productId, stats);
        }
      }

      // If no ranked entries found, show frequency (how often a product was tested) as proxy
      if (productStats.size === 0) {
        const freqStats = new Map<number, number>();
        for (const { test } of selectedTests.slice(0, 200)) {
          const entries = await storage.listEntries(test.id);
          for (const entry of entries) {
            if (!entry.productId) continue;
            freqStats.set(entry.productId, (freqStats.get(entry.productId) ?? 0) + 1);
          }
        }
        const suggestions = Array.from(freqStats.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([productId, count], idx) => {
            const prod = productMap.get(productId);
            const productName = prod ? `${prod.brand} ${prod.name}` : "Unknown";
            return {
              title: `#${idx + 1} ${productName}`,
              description: `Tested ${count} time${count > 1 ? "s" : ""} in similar conditions. No ranking data recorded yet.`,
              products: [productName],
              confidence: "Low",
              matchCount: count,
            };
          });
        if (suggestions.length === 0) {
          return res.json({ suggestions: [{ title: "No data", description: "Tests found but no products or rankings recorded. Add products and results to your tests to get suggestions.", products: [], confidence: "Low" }] });
        }
        return res.json({ suggestions });
      }

      const ranked = Array.from(productStats.entries())
        .map(([productId, stats]) => {
          const avgRank = stats.totalRank / stats.count;
          const winRate = stats.wins / stats.count;
          const score = (1 / avgRank) * 0.6 + winRate * 0.4;
          const confidence: string =
            !noWeatherFallback && tierConfidence === "High" && stats.count >= 3 ? "High" :
            !noWeatherFallback && tierConfidence !== "Low"  && stats.count >= 2 ? "Medium" : "Low";
          return { productId, avgRank, winRate, score, confidence, count: stats.count };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      const suggestions = ranked.map((r, idx) => {
        const prod = productMap.get(r.productId);
        const productName = prod ? `${prod.brand} ${prod.name}` : "Unknown";
        const avgRankStr = r.avgRank.toFixed(1);
        const winPct = (r.winRate * 100).toFixed(0);
        return {
          title: `#${idx + 1} ${productName}`,
          description: `Avg rank ${avgRankStr} across ${r.count} test${r.count > 1 ? "s" : ""}. Win rate: ${winPct}%. ${matchDescription}`,
          products: [productName],
          confidence: r.confidence,
          matchCount: r.count,
        };
      });

      res.json({ suggestions });
    } catch (err: any) {
      console.error("Suggestion error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Watch Queue (Garmin watch app integration) ───────────────────────────

  // Get or generate team's watch PIN (authenticated users)
  app.get("/api/watch/pin", requireAuth, async (req, res) => {
    // The PIN is a bearer credential for the whole team's watch queue — only
    // watch-enabled users need it.
    if (!(await hasGarminWatchAccess(req))) return res.status(403).json({ message: "Watch access not granted" });
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const result = await (pool as any).query(`SELECT watch_pin FROM teams WHERE id = $1`, [teamId]);
    let pin = result.rows[0]?.watch_pin;
    if (!pin) {
      // Generate a random 4-digit PIN
      pin = String(Math.floor(1000 + Math.random() * 9000));
      await (pool as any).query(`UPDATE teams SET watch_pin = $1 WHERE id = $2`, [pin, teamId]);
    }
    res.json({ pin, teamName: u.groupScope || "Team" });
  });

  // Regenerate team's watch PIN
  app.post("/api/watch/pin/regenerate", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team admin only" });
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const { pool } = await import("./db");
    await (pool as any).query(`UPDATE teams SET watch_pin = $1 WHERE id = $2`, [pin, teamId]);
    res.json({ pin });
  });

  // Get team PIN + all watch-enabled users with their codes (watch users only)
  app.get("/api/watch/team-codes", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) {
      return res.status(403).json({ message: "Watch access not granted" });
    }
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");

    // Get team PIN (auto-generate if missing)
    const pinResult = await (pool as any).query(`SELECT watch_pin FROM teams WHERE id = $1`, [teamId]);
    let pin: string = pinResult.rows[0]?.watch_pin;
    if (!pin) {
      pin = String(Math.floor(1000 + Math.random() * 9000));
      await (pool as any).query(`UPDATE teams SET watch_pin = $1 WHERE id = $2`, [pin, teamId]);
    }

    // All users with garmin_watch access (flag set OR team admin)
    const usersResult = await (pool as any).query(
      `SELECT id, name, watch_code, is_team_admin FROM users
       WHERE team_id = $1 AND is_active = 1 AND (garmin_watch = 1 OR is_team_admin = 1)
       ORDER BY name`,
      [teamId]
    );

    // Ensure every eligible user has a watch code
    const members = [];
    for (const row of usersResult.rows) {
      let code: string = row.watch_code;
      if (!code) {
        do {
          code = String(Math.floor(1000 + Math.random() * 9000));
          const conflict = await (pool as any).query(
            `SELECT id FROM users WHERE watch_code = $1`, [code]
          );
          if (conflict.rows.length === 0) break;
        } while (true);
        await (pool as any).query(`UPDATE users SET watch_code = $1 WHERE id = $2`, [code, row.id]);
      }
      members.push({ id: row.id, name: row.name, watchCode: code, isTeamAdmin: row.is_team_admin === 1 });
    }

    res.json({ teamPin: pin, members });
  });

  // Check if user has garmin_watch access (team feature enabled + per-user flag, or admin)
  async function hasGarminWatchAccess(req: Request): Promise<boolean> {
    const u = req.user!;
    if (u.isAdmin === 1) return true;
    // Check team feature gate
    const teamId = getActiveTeamId(req);
    try {
      const team = await storage.getTeam(teamId);
      if (team?.enabledAreas) {
        const enabled: string[] = JSON.parse(team.enabledAreas as string);
        if (!enabled.includes("garmin_watch")) return false;
      }
    } catch (_) {}
    if (u.isTeamAdmin === 1) return true;
    return !!u.garminWatch;
  }

  // Get active watch queue for current team (authenticated + garminWatch access)
  app.get("/api/watch/queue", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) {
      return res.status(403).json({ message: "Watch Queue access not granted" });
    }
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT * FROM watch_queue WHERE team_id = $1 AND status = 'active' ORDER BY added_at DESC`,
      [teamId]
    );
    res.json(result.rows);
  });

  // Get watch queue archive for current team (authenticated + garminWatch access)
  app.get("/api/watch/queue/archive", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) {
      return res.status(403).json({ message: "Watch Queue access not granted" });
    }
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT * FROM watch_queue WHERE team_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 10`,
      [teamId]
    );
    res.json(result.rows);
  });

  // Add test to watch queue (authenticated + garminWatch access)
  app.post("/api/watch/queue", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) {
      return res.status(403).json({ message: "Watch Queue access not granted" });
    }
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { testId, seriesId, testName, seriesName } = req.body;
    if (testId) {
      const qTest = await storage.getTest(Number(testId));
      if (!qTest || (qTest as any).teamId !== teamId) return res.status(403).json({ message: "Forbidden" });
    }
    const { pool } = await import("./db");
    // Check if already in queue
    const existing = await (pool as any).query(
      `SELECT id FROM watch_queue WHERE team_id = $1 AND test_id = $2 AND status = 'active'`,
      [teamId, testId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Already in watch queue" });
    }

    // Auto-create a watch session from the test's entries so Garmin can join directly
    let sessionCode: string | null = null;
    if (testId) {
      try {
        const entriesRows = await db.select().from(testEntries).where(eq(testEntries.testId, Number(testId)));
        if (entriesRows.length >= 2) {
          const skiPairs = entriesRows.map((e) => e.skiNumber).sort((a, b) => a - b);
          // Use correct labels — handles both race skis (serialNumber) and series pairLabels
          const skiLabels = await getSkiLabelsForTest(Number(testId));
          sessionCode = await generateSessionCode();
          const session: WatchSession = {
            code: sessionCode,
            skiPairs,
            skiLabels,
            bracket: watchInitBracket(skiPairs),
            createdAt: Date.now(),
            userId: u.id,
            userName: u.name,
            testId: Number(testId),
            testInfo: null,
            teamId,
          };
          await saveWatchSession(session);
        }
      } catch (err) {
        // Session creation failed — queue item still added, just without a code
        sessionCode = null;
      }
    }

    const result = await (pool as any).query(
      `INSERT INTO watch_queue (team_id, test_id, series_id, test_name, series_name, added_by_name, added_at, status, session_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8) RETURNING *`,
      [teamId, testId || null, seriesId || null, testName || null, seriesName || null, u.name, new Date().toISOString(), sessionCode]
    );
    res.json(result.rows[0]);
  });

  // Refresh (regenerate) session code for a queue item
  app.post("/api/watch/queue/:id/refresh-code", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team admin only" });
    const teamId = getActiveTeamId(req);
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    const itemResult = await (pool as any).query(
      `SELECT * FROM watch_queue WHERE id = $1 AND team_id = $2 AND status = 'active'`, [id, teamId]
    );
    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ message: "Queue item not found" });
    if (!item.test_id) return res.status(400).json({ message: "No test associated" });

    // Delete old session if exists
    if (item.session_code) await deleteWatchSession(item.session_code);

    const entriesRows = await db.select().from(testEntries).where(eq(testEntries.testId, Number(item.test_id)));
    if (entriesRows.length < 2) return res.status(400).json({ message: "Not enough entries" });

    const skiPairs = entriesRows.map((e) => e.skiNumber).sort((a, b) => a - b);
    const skiLabels = await getSkiLabelsForTest(item.test_id);
    const newCode = await generateSessionCode();
    const session: WatchSession = {
      code: newCode, skiPairs, skiLabels,
      bracket: watchInitBracket(skiPairs),
      createdAt: Date.now(), userId: u.id, userName: u.name,
      testId: Number(item.test_id), testInfo: null, teamId,
    };
    await saveWatchSession(session);
    await (pool as any).query(`UPDATE watch_queue SET session_code = $1 WHERE id = $2`, [newCode, id]);
    res.json({ code: newCode });
  });

  // Remove from watch queue (authenticated)
  app.delete("/api/watch/queue/:id", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) return res.status(403).json({ message: "Watch Queue access not granted" });
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    await (pool as any).query(`DELETE FROM watch_queue WHERE id = $1 AND team_id = $2`, [id, teamId]);
    res.json({ ok: true });
  });

  // Restore archived item back to active queue
  app.post("/api/watch/queue/:id/restore", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) return res.status(403).json({ message: "Watch Queue access not granted" });
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE watch_queue SET status = 'active', completed_at = NULL WHERE id = $1 AND team_id = $2`,
      [id, teamId]
    );
    res.json({ ok: true });
  });

  // ── Watch device authentication: personal code + team PIN ────────────────
  // Called by the Garmin/watch app during login. No session auth required.
  app.post("/api/watch/auth", async (req, res) => {
    const { userCode, teamPin } = req.body ?? {};
    if (!userCode || !teamPin) {
      return res.status(400).json({ message: "userCode and teamPin are required" });
    }
    if (!/^\d{4}$/.test(String(userCode))) {
      return res.status(400).json({ message: "Personal ID must be a 4-digit code" });
    }
    const { pool } = await import("./db");

    // Resolve user by personal watch code
    const userRow = await (pool as any).query(
      "SELECT id, name, is_admin, is_team_admin, garmin_watch, team_id FROM users WHERE watch_code = $1 AND is_active = 1",
      [String(userCode)]
    );
    if (!userRow.rows[0]) {
      return res.status(404).json({ message: "Personal ID not found" });
    }
    const watchUser = userRow.rows[0];

    // Resolve team by PIN
    const teamRow = await (pool as any).query(
      "SELECT id, name, enabled_areas FROM teams WHERE watch_pin = $1",
      [String(teamPin)]
    );
    if (!teamRow.rows[0]) {
      return res.status(404).json({ message: "Team ID not found" });
    }
    const team = teamRow.rows[0];

    // Check team-level garmin_watch feature gate
    if (watchUser.is_admin !== 1) {
      let enabledAreas: string[] = [];
      try { enabledAreas = JSON.parse(team.enabled_areas ?? "[]"); } catch (_) {}
      if (!enabledAreas.includes("garmin_watch")) {
        return res.status(403).json({ message: "Watch access is not enabled for this team" });
      }
    }

    // Check user has access to this team (primary team OR member of team via user_teams)
    if (watchUser.is_admin !== 1) {
      const teamId: number = Number(team.id);
      const isOwnTeam = Number(watchUser.team_id) === teamId;
      let isMember = isOwnTeam;
      if (!isMember) {
        const memberRow = await (pool as any).query(
          "SELECT id FROM user_teams WHERE user_id = $1 AND team_id = $2",
          [watchUser.id, teamId]
        );
        isMember = memberRow.rows.length > 0;
      }
      if (!isMember) {
        return res.status(403).json({ message: "You don't have access to this team" });
      }

      // Check per-user garmin_watch flag (team admins always get access)
      if (watchUser.is_team_admin !== 1 && !watchUser.garmin_watch) {
        return res.status(403).json({ message: "Watch Queue access not granted for your account" });
      }
    }

    res.json({
      userId: watchUser.id,
      userName: watchUser.name,
      teamId: team.id,
      teamName: team.name,
    });
  });

  // ── Public watch API (authenticated by team watch PIN) ────────────────────

  // Resolve PIN → team (used by Garmin app)
  app.get("/api/watch/resolve/:pin", async (req, res) => {
    const ipW = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    if (watchPinRateLimit(ipW)) return res.status(429).json({ message: "Too many attempts. Try again in 5 minutes." });
    const { pin } = req.params;
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT id, name FROM teams WHERE watch_pin = $1`,
      [pin]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    res.json({ teamId: result.rows[0].id, teamName: result.rows[0].name });
  });

  // Get active queue by PIN (Garmin app)
  app.get("/api/watch/list/:pin", async (req, res) => {
    const ipW = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    if (watchPinRateLimit(ipW)) return res.status(429).json({ message: "Too many attempts. Try again in 5 minutes." });
    const { pin } = req.params;
    const { pool } = await import("./db");
    const teamResult = await (pool as any).query(
      `SELECT id, enabled_areas FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    const teamId = teamResult.rows[0].id;

    // Validate userCode if provided (query param ?userCode=XXXX)
    // Only checks team membership — garmin_watch feature is validated at /api/watch/auth time
    const userCode = typeof req.query.userCode === "string" ? req.query.userCode : null;
    if (userCode && /^\d{4}$/.test(userCode)) {
      try {
        const userRow = await (pool as any).query(
          "SELECT id, is_admin, team_id FROM users WHERE watch_code = $1 AND is_active = 1",
          [userCode]
        );
        const watchUser = userRow.rows[0];
        if (!watchUser) {
          return res.status(403).json({ message: "Personal ID not found" });
        }
        if (watchUser.is_admin !== 1) {
          // Only check team membership (garmin_watch access already validated at login)
          const isOwnTeam = Number(watchUser.team_id) === Number(teamId);
          let isMember = isOwnTeam;
          if (!isMember) {
            const memberRow = await (pool as any).query(
              "SELECT id FROM user_teams WHERE user_id = $1 AND team_id = $2",
              [watchUser.id, teamId]
            );
            isMember = memberRow.rows.length > 0;
          }
          if (!isMember) {
            return res.status(403).json({ message: "No access to this team" });
          }
        }
      } catch (_) {
        // Validation error — still return list to avoid blocking watch access
      }
    }

    const result = await (pool as any).query(
      `SELECT id, test_id, series_id, test_name, series_name, added_by_name, added_at FROM watch_queue
       WHERE team_id = $1 AND status = 'active' ORDER BY added_at DESC`,
      [teamId]
    );
    res.json({ items: result.rows });
  });

  // Watch diagnostic endpoint — shows queue status, session state, and config
  app.get("/api/watch/debug/:pin", requireAuth, async (req, res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: "Admin only" });
    const { pin } = req.params;
    const { pool } = await import("./db");
    const teamResult = await (pool as any).query(
      `SELECT id, name, watch_pin, enabled_areas FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN", pin });
    const team = teamResult.rows[0];
    const teamId = team.id;
    let enabledAreas: string[] = [];
    try { enabledAreas = JSON.parse(team.enabled_areas ?? "[]"); } catch {}
    const garminEnabled = enabledAreas.includes("garmin_watch");

    const queueResult = await (pool as any).query(
      `SELECT id, test_id, series_id, test_name, series_name, session_code, status, added_at FROM watch_queue
       WHERE team_id = $1 ORDER BY added_at DESC LIMIT 20`,
      [teamId]
    );
    const items = queueResult.rows;

    // Check which items have valid sessions
    const now = new Date().toISOString();
    const sessionChecks = await Promise.all(items.map(async (item: any) => {
      let sessionStatus = "no_code";
      if (item.session_code) {
        const sess = await getWatchSession(item.session_code);
        sessionStatus = sess ? "active" : "expired";
      }
      let entryCount = 0;
      if (item.test_id) {
        try {
          const ec = await (pool as any).query(`SELECT COUNT(*) FROM test_entries WHERE test_id = $1`, [item.test_id]);
          entryCount = parseInt(ec.rows[0]?.count ?? "0");
        } catch {}
      }
      return { id: item.id, name: item.test_name || item.series_name, status: item.status, sessionStatus, entryCount, testId: item.test_id, seriesId: item.series_id };
    }));

    res.json({
      team: { id: teamId, name: team.name, garminEnabled, watchPin: pin },
      maintenanceMode,
      queueItems: sessionChecks,
      activeSessions: watchSessionsMemory.size,
      serverTime: now,
    });
  });

  // Get archive by PIN (Garmin app — last 10 completed)
  app.get("/api/watch/archive/:pin", async (req, res) => {
    const ipW = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    if (watchPinRateLimit(ipW)) return res.status(429).json({ message: "Too many attempts. Try again in 5 minutes." });
    const { pin } = req.params;
    const { pool } = await import("./db");
    const teamResult = await (pool as any).query(
      `SELECT id FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    const teamId = teamResult.rows[0].id;
    const result = await (pool as any).query(
      `SELECT id, test_id, series_id, test_name, series_name, completed_at FROM watch_queue
       WHERE team_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 10`,
      [teamId]
    );
    res.json({ items: result.rows });
  });

  // Start a session from queue item (Garmin app) — returns stored session code
  app.post("/api/watch/list/:pin/start/:itemId", async (req, res) => {
    const ipW = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    if (watchPinRateLimit(ipW)) return res.status(429).json({ message: "Too many attempts. Try again in 5 minutes." });
    const { pin, itemId } = req.params;
    const { pool } = await import("./db");
    const teamResult = await (pool as any).query(
      `SELECT id FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    const teamId = teamResult.rows[0].id;
    const itemResult = await (pool as any).query(
      `SELECT * FROM watch_queue WHERE id = $1 AND team_id = $2`, [parseInt(itemId), teamId]
    );
    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ message: "Queue item not found" });

    // Fetch labels — handles race skis (serialNumber) and series pairLabels
    const skiLabels = await getSkiLabelsForTest(item.test_id);
    const labelsJson = JSON.stringify(skiLabels);

    // Resolve operator name from personal watch code if provided
    const userCode = req.body?.userCode ?? req.query.userCode;
    let resolvedOperatorName: string | undefined;
    if (userCode && /^\d{4}$/.test(String(userCode))) {
      try {
        const opRow = await (pool as any).query(
          "SELECT name FROM users WHERE watch_code = $1 AND is_active = 1", [String(userCode)]
        );
        if (opRow.rows[0]) resolvedOperatorName = opRow.rows[0].name;
      } catch (_) {}
    }

    // 1. Use the stored session code if it's still valid
    if (item.session_code) {
      const existingSession = await getWatchSession(item.session_code);
      if (existingSession) {
        // Always sync skiLabels; also update operatorName if watch user logged in
        existingSession.skiLabels = skiLabels;
        if (resolvedOperatorName) existingSession.operatorName = resolvedOperatorName;
        watchSessionsMemory.set(existingSession.code, existingSession);
        await db.update(watchSessions)
          .set({ skiLabels: labelsJson, ...(resolvedOperatorName ? { operatorName: resolvedOperatorName } : {}) })
          .where(eq(watchSessions.code, existingSession.code))
          .catch(() => {});
        return res.json({ code: item.session_code, testName: item.test_name, seriesName: item.series_name, queueItemId: item.id });
      }
    }

    // 2. Session expired or missing — recreate from test entries
    if (item.test_id) {
      try {
        const entriesRows = await db.select().from(testEntries).where(eq(testEntries.testId, Number(item.test_id)));
        if (entriesRows.length >= 2) {
          const skiPairs = entriesRows.map((e) => e.skiNumber).sort((a, b) => a - b);
          const newCode = await generateSessionCode();
          const session: WatchSession = {
            code: newCode,
            skiPairs,
            skiLabels,
            bracket: watchInitBracket(skiPairs),
            createdAt: Date.now(),
            userId: 0,
            userName: item.added_by_name,
            operatorName: resolvedOperatorName,
            testId: Number(item.test_id),
            testInfo: null,
            teamId,
          };
          await saveWatchSession(session);
          await (pool as any).query(
            `UPDATE watch_queue SET session_code = $1 WHERE id = $2`,
            [newCode, item.id]
          );
          return res.json({ code: newCode, testName: item.test_name, seriesName: item.series_name, queueItemId: item.id });
        }
      } catch (_) {}
    }

    // 3. No test_id — try series-based: build ski pairs from series pairLabels
    if (item.series_id) {
      try {
        const seriesRows = await db.select({ pairLabels: testSkiSeries.pairLabels, name: testSkiSeries.name })
          .from(testSkiSeries).where(eq(testSkiSeries.id, Number(item.series_id)));
        const seriesRow = seriesRows[0];
        if (seriesRow?.pairLabels) {
          const parsed = JSON.parse(seriesRow.pairLabels);
          const labelKeys = Object.keys(parsed).map(Number).filter(n => !isNaN(n));
          if (labelKeys.length >= 2) {
            const skiPairs = labelKeys.sort((a, b) => a - b);
            const seriesLabels: Record<number, string> = {};
            for (const k of skiPairs) {
              const v = parsed[k];
              if (typeof v === "string" && v.trim()) seriesLabels[k] = v.trim();
            }
            const newCode = await generateSessionCode();
            const session: WatchSession = {
              code: newCode,
              skiPairs,
              skiLabels: seriesLabels,
              bracket: watchInitBracket(skiPairs),
              createdAt: Date.now(),
              userId: 0,
              userName: item.added_by_name,
              operatorName: resolvedOperatorName,
              testId: null,
              testInfo: null,
              teamId,
            };
            await saveWatchSession(session);
            await (pool as any).query(
              `UPDATE watch_queue SET session_code = $1 WHERE id = $2`,
              [newCode, item.id]
            );
            return res.json({ code: newCode, testName: item.test_name, seriesName: item.series_name ?? seriesRow.name, queueItemId: item.id });
          }
        }
      } catch (_) {}
    }

    // 4. Cannot create session
    res.json({ code: null, testName: item.test_name, seriesName: item.series_name, queueItemId: item.id });
  });

  // Mark queue item as completed (in-app: phone runsheet flow / testers)
  app.post("/api/watch/queue/:id/complete", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE watch_queue SET status = 'completed', completed_at = $1 WHERE id = $2 AND team_id = $3`,
      [new Date().toISOString(), parseInt(req.params.id), teamId]
    );
    res.json({ ok: true });
  });

  // Mark queue item as completed (called by watch app after finishing)
  app.post("/api/watch/list/:pin/complete/:itemId", async (req, res) => {
    const ipW = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    if (watchPinRateLimit(ipW)) return res.status(429).json({ message: "Too many attempts. Try again in 5 minutes." });
    const { pin, itemId } = req.params;
    const { pool } = await import("./db");
    const teamResult = await (pool as any).query(
      `SELECT id FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    const teamId = teamResult.rows[0].id;
    await (pool as any).query(
      `UPDATE watch_queue SET status = 'completed', completed_at = $1 WHERE id = $2 AND team_id = $3`,
      [new Date().toISOString(), parseInt(itemId), teamId]
    );
    res.json({ ok: true });
  });

  // ──────────────────────────────────────────────────────────────────────────

  // ─── Report a Problem + SA Inbox ─────────────────────────────────────────

  // POST /api/report-problem — any authenticated user submits a problem report
  app.post("/api/report-problem", requireAuth, async (req, res) => {
    const { subject, body } = req.body || {};
    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return res.status(400).json({ message: "Subject is required" });
    }
    if (subject.length > 200) {
      return res.status(400).json({ message: "Subject must be 200 characters or fewer" });
    }
    if (!body || typeof body !== "string" || body.trim().length === 0) {
      return res.status(400).json({ message: "Body is required" });
    }
    if (body.length > 2000) {
      return res.status(400).json({ message: "Body must be 2000 characters or fewer" });
    }

    const sender = req.user!;
    const { pool } = await import("./db");

    // Get sender's team name
    let teamName: string | null = null;
    try {
      const teamRow = await (pool as any).query(
        `SELECT name FROM teams WHERE id = $1`,
        [sender.teamId]
      );
      teamName = teamRow.rows[0]?.name ?? null;
    } catch (_) {}

    // Get all SA users
    const saResult = await (pool as any).query(
      `SELECT id, name FROM users WHERE is_admin = 1`
    );
    const saUsers: { id: number; name: string }[] = saResult.rows;

    const now = new Date().toISOString();
    for (const sa of saUsers) {
      await (pool as any).query(
        `INSERT INTO inbox_messages (to_user_id, from_user_id, from_name, subject, body, is_read, created_at, team_name)
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7)`,
        [sa.id, sender.id, sender.name, subject.trim(), body.trim(), now, teamName]
      );
    }

    // #22: also append the report to a Google Sheet so the SA can monitor issues
    // in one place (date, time, reporter, team, topic, problem). Best-effort.
    try {
      const sheetUrl = process.env.ISSUES_SHEET_URL;
      const { isGoogleSheetsAvailable, getUncachableGoogleSheetClient } = await import("./googleSheets");
      const m = sheetUrl ? sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/) : null;
      if (m && isGoogleSheetsAvailable()) {
        const d = new Date(now);
        const sheets = await getUncachableGoogleSheetClient();
        await sheets.spreadsheets.values.append({
          spreadsheetId: m[1],
          range: "A1",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              d.toLocaleDateString("no-NO"),
              d.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }),
              sender.name, sender.email, teamName || "", subject.trim(), body.trim(),
            ]],
          },
        });
      }
    } catch (err) {
      console.warn("[ReportProblem] Could not append to issues sheet:", (err as any)?.message);
    }

    // #30: email the owner so follow-ups don't require logging in daily.
    try {
      const { sendProblemReportNotification } = await import("./email");
      sendProblemReportNotification({ fromName: sender.name, fromEmail: (sender as any).email, teamName, subject: subject.trim(), body: body.trim() }).catch(() => {});
    } catch {}

    return res.json({ ok: true });
  });

  // GET /api/inbox — return inbox messages for current user
  app.get("/api/inbox", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT id, to_user_id AS "toUserId", from_user_id AS "fromUserId", from_name AS "fromName",
              subject, body, is_read AS "isRead", created_at AS "createdAt",
              team_name AS "teamName", action_type AS "actionType", action_data AS "actionData"
       FROM inbox_messages WHERE to_user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
    return res.json(result.rows);
  });

  // GET /api/inbox/unread-count — return unread count for current user
  app.get("/api/inbox/unread-count", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT COUNT(*) FROM inbox_messages WHERE to_user_id = $1 AND is_read = 0`,
      [userId]
    );
    return res.json({ count: parseInt(result.rows[0].count, 10) });
  });

  // ── Add from picture ──────────────────────────────────────────────────────

  // POST /api/tests/from-picture/analyze — analyze image with Groq vision (free tier)
  app.post("/api/tests/from-picture/analyze", requireAuth, async (req, res) => {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ message: "imageBase64 and mimeType required" });
    }
    const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      return res.status(400).json({ message: "Unsupported image type" });
    }
    const maxBase64Size = 4 * 1024 * 1024; // ~3MB decoded
    if (!imageBase64 || imageBase64.length > maxBase64Size) {
      return res.status(413).json({ message: "Image too large" });
    }
    const groqKey = process.env.GROQ_API_KEY;
    // Accept a standard OPENAI_API_KEY (e.g. on Render) or the Replit-managed key.
    const openaiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    if (!groqKey && !openaiKey && !hasGemini) {
      return res.status(500).json({ message: "No vision model configured (set GEMINI_API_KEY, OPENAI_API_KEY or GROQ_API_KEY)" });
    }

    // ── Load team's product database for server-side matching ──────────────
    // We do NOT put the product list in the prompt — weak vision models tend to
    // collapse every product onto one DB entry. The AI transcribes names literally;
    // matching is done deterministically here.
    let dbProducts: { id: number; brand: string; name: string }[] = [];
    try {
      const teamIdForMatch = getActiveTeamId(req);
      const { pool } = await import("./db");
      const dbRows = await (pool as any).query(
        `SELECT id, brand, name FROM products WHERE team_id = $1 ORDER BY brand, name`,
        [teamIdForMatch]
      );
      dbProducts = dbRows.rows;
    } catch (_) { /* best-effort */ }

    const prompt = `You are analyzing a handwritten ski wax test result sheet. Extract all data and return ONLY raw JSON — no markdown, no explanation, no code block.

=== NOTATION GUIDE (read carefully) ===

DATE: Often written as DD/MM or DD/MM/YY at the top. Convert to YYYY-MM-DD. If year is missing, use the most recent plausible year.

LOCATION: Usually a city/resort name near the date (e.g. "Bad Gastein", "Beitostølen", "Ruka").

WEATHER: Extract all weather data you can find anywhere on the sheet. It may be abbreviated near the date or in a separate section. Common notations: "L: -10" or "Luft: -10" = air temp -10°C; "S: -8" or "Snø: -8" = snow temp -8°C; a lone "22%" near the temps = snow humidity; "L: -10°" with a degree sign is still air temp. Norwegian abbreviations: L/Luft = air, S/Snø = snow. Also capture wind, clouds, precipitation and snow type if written. Leave fields null when not present — do not guess.

SKI GROUPS: The sheet may be divided into groups like "Blå 1", "Blå 2", "Rød" etc. — these are different test ski series. Each group is a separate test.

EACH SKI-PAIR LINE HAS THIS EXACT STRUCTURE (left to right):
[ski number] [product name] [APPLICATION temperature] ............ [RESULT column(s)]

1. SKI NUMBER: the number at the very START of the line (1, 2, 3 …).
2. PRODUCT NAME: the words after the ski number.
3. APPLICATION TEMPERATURE: the number written IMMEDIATELY AFTER the product name, usually with a degree sign (e.g. "180°", "170°", "200°"). This is ALWAYS the application/iron temperature — NEVER a result. Put it in "methodology" as e.g. "180°C". A product line like "LDR White 180°" = product "LDR White", methodology "180°C".
4. RESULT COLUMN(S): the number(s) at the FAR RIGHT of the line, clearly separated from the product by a gap. These are the test results in cm behind the leader (0 = winner). Each separate column to the right = one distance/round. If there are 2 right-hand columns, that is 2 rounds → return 2 elements in "results". If 1 column → 1 element.

CRITICAL: Do NOT confuse the application temperature (right after the product, with °) with a result. The application number has a degree sign and sits next to the product; the result sits far right with a gap. If a line is "PC100 200° ... 200", then 200° is methodology "200°C" and the far-right 200 is the result.

=== PRE-PRINTED BLOCK SHEETS (US form) ===

Some sheets are PRE-PRINTED grids instead of free-hand lists. Recognize them by:
a header with "Venue:"/"Race:"/"Date:", and several boxed TABLE BLOCKS, each
with a printed header row like: Series | Paraffin (or Topping / Structure) |
cm | cm | cm | cm total | Rank.

For these sheets, follow THESE rules instead of the free-hand rules:

1. EACH BLOCK IS ITS OWN TEST GROUP. A sheet typically holds several blocks
   (e.g. Paraffin, Topping, two Structure blocks) — output one object per
   block, in reading order. Block title mapping: "Paraffin" and "Topping"
   → testType "Glide"; "Structure" → testType "Structure". Use the block
   title as "seriesName" (e.g. "Paraffin", "Topping", "Structure 1").
2. SKI NUMBER = the printed "Series" number at the start of each row
   (1–8, 21–28, 31–38 …). Keep it exactly as printed.
3. USE ONLY TWO THINGS PER ROW: the handwritten PRODUCT NAME, and the value
   in the "cm total" column — the SECOND-TO-LAST column, directly left of
   Rank. That single number IS the distance: put it as the single element of
   "results" (one round). NEVER sum, average or combine the individual cm run
   columns yourself — even when cm total looks inconsistent with the runs,
   the cm total column wins. IGNORE the cm run columns entirely, IGNORE the
   handwritten Rank column (the system recomputes ranks from cm total), and
   IGNORE tally marks (IIII) after product names — they are run counts, not
   part of the name.
4. If the "cm total" cell is truly blank, leave results as [null] — do NOT
   substitute a run value or compute one. If the whole row is blank, skip it.
5. MULTIPLE PRODUCTS in one name cell (separated by "+", "/", or clearly two
   names) → separate entries in "products", same skiNumber — never one
   combined name. A trailing word like "liquid" belongs to the product name.
6. Blocks whose rows have series numbers but NO product names are extra runs
   of an earlier block — SKIP those blocks entirely.
7. DATE on these sheets is US-style MM.DD.YY (e.g. "01.29.25" = 2025-01-29).
   If one part is > 12 it is the day. Venue = "Venue:" value; "Race:" value
   goes into notes.
8. "application" is always "" on these sheets — do not invent temperatures.

=== FREE-HAND SHEETS ===

"+" NOTATION: "+" means TWO SEPARATE products on the SAME ski pair (each may have its own application temp). List each as a separate product object with the same skiNumber. The methodology may then contain both temps.

"–ii–" / "--ii--" / "—ii—" NOTATION: means "same product(s) as the ski pair directly ABOVE this one". Copy the product(s) from the previous ski pair. Only the part written AFTER a "+" is new. Example: ski 3 = "–ii– + FFC 34 m/ull" → same base product as ski 2, PLUS a second product "FFC 34 m/ull".

PRODUCT NAMES: Transcribe the product name EXACTLY as written on the paper — do NOT guess, expand, or substitute names. Write what you literally see (e.g. "LDR White", "Date Cold", "SIX", "WM25", "PC100"). The system matches these to the database afterwards — your only job is accurate transcription. NEVER replace a product with a different product name.

HOW MANY RESULT COLUMNS / ROUNDS: Look carefully at the right side. Count the distinct vertical columns of result numbers. MOST sheets have exactly ONE result column = ONE round → each ski's "results" has exactly one number. Only output more than one result per ski if you clearly see TWO OR MORE separate, aligned number columns on the right. Do NOT invent extra rounds. When unsure, use one.

=== OUTPUT FORMAT ===

Return a JSON ARRAY — one object per ski GROUP (series). Process the sheet ROW BY ROW. For each ski-pair line, produce ONE object inside "skis" that keeps that pair's number, product(s), application and result TOGETHER (this prevents mixing up which result belongs to which pair).

[
  {
    "seriesName": "Blå 1" or "Rød" or null,
    "date": "YYYY-MM-DD or null",
    "location": "location name or null",
    "testType": "Glide" | "Structure" | "Classic" | "Skating" | "Double Poling" | "Grind" | null,
    "notes": "any notes or null",
    "weather": {
      "airTemperatureC": number|null, "snowTemperatureC": number|null,
      "snowHumidityPct": number|null, "airHumidityPct": number|null,
      "snowType": string|null, "wind": string|null, "clouds": integer|null, "precipitation": string|null
    },
    "skis": [
      {
        "skiNumber": 1,
        "products": [ { "brand": "", "name": "LDR White" } ],
        "application": "180°C",
        "results": [70]
      }
    ]
  }
]

RULES:
- ONE object in "skis" per ski-pair line, in top-to-bottom order.
- "results" is an array of the FAR-RIGHT numbers for that pair, left-to-right, one per round. Usually a single number, e.g. [70]. The application temperature is NEVER in results.
- "application" = the temperature right after the product name (e.g. "180°C"). Empty string if none.
- "products": one entry per product. For "A + B" put two entries. For "–ii–" copy the product(s) from the ski directly above, then add anything after "+".
- Transcribe product names EXACTLY as written — never substitute.
- Read each result number carefully and keep it on the SAME line/pair it was written next to. Do not shift results up or down between pairs.
- Weather is shared across groups on the same sheet unless written separately.`;

    // Vision model priority: OpenAI (paid, best) → Gemini (free key, strong) →
    // Groq llama-4-maverick (free, no setup). Each is tried in turn on failure.
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;
    const callOpenAI = async (): Promise<string> => {
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
      const r = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          }],
          temperature: 0,
          max_tokens: 6000,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json() as any;
      return (j.choices?.[0]?.message?.content || "").trim();
    };
    const callGemini = async (): Promise<string> => {
      const model = "gemini-2.0-flash";
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 8000 },
          }),
          signal: AbortSignal.timeout(60000),
        }
      );
      if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json() as any;
      const parts = j.candidates?.[0]?.content?.parts ?? [];
      return parts.map((p: any) => p.text || "").join("").trim();
    };
    const callGroq = async (): Promise<string> => {
      // Groq retires model ids without notice, so never depend on one name:
      // try the env override first, then each known vision model until one
      // answers. A 404/decommission moves on; other errors abort that model.
      const candidates = [
        process.env.GROQ_VISION_MODEL,
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "meta-llama/llama-4-scout-17b-16e-instruct",
      ].filter(Boolean) as string[];
      let lastGroqErr = "";
      for (const model of candidates) {
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model,
            messages: [{
              role: "user",
              content: [
                { type: "image_url", image_url: { url: dataUrl } },
                { type: "text", text: prompt },
              ],
            }],
            temperature: 0,
            max_tokens: 6000,
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (r.ok) {
          const j = await r.json() as any;
          return (j.choices?.[0]?.message?.content || "").trim();
        }
        const body = (await r.text()).slice(0, 200);
        lastGroqErr = `Groq ${r.status} (${model}): ${body}`;
        // Unknown model → try the next candidate; anything else is a real error.
        if (!(r.status === 404 || body.includes("model_not_found") || body.includes("decommissioned"))) break;
      }
      throw new Error(lastGroqErr || "Groq: no vision model available");
    };

    try {
      let text = "";
      let lastErr = "";
      if (openaiKey) {
        try { text = await callOpenAI(); }
        catch (e: any) { lastErr = e?.message || "OpenAI failed"; }
      }
      if (!text && geminiKey) {
        try { text = await callGemini(); }
        catch (e: any) { lastErr = e?.message || lastErr || "Gemini failed"; }
      }
      if (!text && groqKey) {
        try { text = await callGroq(); }
        catch (e: any) { lastErr = e?.message || lastErr || "Groq failed"; }
      }
      if (!text) {
        return res.status(500).json({ message: `Could not analyze the image: ${lastErr || "no response"}` });
      }
      try {
        // Accept both array and single object response
        const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
        let parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        if (!Array.isArray(parsed)) parsed = [parsed];

        // ── Transform row-based "skis" into products[] + entries[] ──────────
        // The model outputs one self-contained object per ski pair (number +
        // products + application + result) which keeps results aligned to the
        // right pair. We flatten that into the shape the rest of the flow expects.
        for (const group of parsed) {
          if (Array.isArray(group.skis)) {
            const products: any[] = [];
            const entries: any[] = [];
            for (const ski of group.skis) {
              const skiNumber = ski.skiNumber;
              for (const p of (ski.products || [])) {
                products.push({ skiNumber, brand: p.brand || "", name: p.name || "" });
              }
              const resultsArr = Array.isArray(ski.results) ? ski.results : [];
              entries.push({
                skiNumber,
                methodology: ski.application || "",
                results: (resultsArr.length > 0 ? resultsArr : [null]).map((v: any) => ({
                  result: (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v),
                  rank: null,
                })),
              });
            }
            group.products = products;
            group.entries = entries;
            delete group.skis;
          }
        }

        // ── Deterministic product matching against the team DB ──────────────
        // The AI transcribes names literally; we match here using containment
        // scoring: how much of the (short) scanned name is found in a DB product.
        if (dbProducts.length > 0) {
          const norm = (s: string) =>
            s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

          // Waxers write brand CODES on paper: "SWX PF85" means Swix PF85. The
          // transcription stays literal; the code is expanded here, before
          // matching. Confirmed codes first, then a data-driven fallback: a
          // short all-caps token that prefix-matches exactly ONE brand in the
          // team's own product DB expands to that brand (TOK→Toko, VAU→Vauhti)
          // — ambiguous or unknown codes are left untouched.
          const BRAND_CODES: Record<string, string> = {
            swx: "Swix", mpl: "Maplus", rex: "Rex",
            sta: "Star", str: "Star", tok: "Toko",
          };
          const dbBrands = Array.from(new Set(dbProducts.map((d) => d.brand))).filter(Boolean);
          const expandBrandCode = (raw: string): string => {
            const tokens = raw.trim().split(/\s+/);
            if (tokens.length === 0) return raw;
            const first = tokens[0].toLowerCase().replace(/[^a-z]/g, "");
            if (first.length < 2 || first.length > 4) return raw;
            let brand = BRAND_CODES[first];
            if (!brand) {
              const hits = dbBrands.filter((b) => b.toLowerCase().startsWith(first));
              if (hits.length === 1) brand = hits[0];
            }
            if (!brand || brand.toLowerCase() === tokens[0].toLowerCase()) return raw;
            return [brand, ...tokens.slice(1)].join(" ");
          };

          const tokenize = (s: string): string[] =>
            norm(s).split(" ").filter(Boolean);
          // A token is "distinctive" if it contains a digit (e.g. wm25, pc100, r30)
          const isDistinctive = (t: string) => /\d/.test(t);

          // Returns containment score 0..1, or -1 if a distinctive token mismatched.
          const matchScore = (scanned: string, dbName: string): number => {
            const ta = tokenize(scanned);
            const tb = new Set(tokenize(dbName));
            if (ta.length === 0 || tb.size === 0) return 0;
            let hits = 0;
            for (const t of ta) {
              if (tb.has(t)) {
                hits++;
              } else if (isDistinctive(t)) {
                // A distinctive token (e.g. "wm25") that is NOT in the DB product
                // is a hard mismatch — prevents WM25 matching WM30.
                return -1;
              }
            }
            return hits / ta.length; // containment: fraction of scanned tokens found
          };

          // Corrections the team has made in earlier reviews: exact recall
          // beats fuzzy matching. Keyed on the literal transcription, so the
          // same handwriting quirk resolves the same way every time.
          const corrections = new Map<string, { brand: string; name: string }>();
          try {
            const teamIdC = getActiveTeamId(req);
            const { pool: poolC } = await import("./db");
            const cr = await (poolC as any).query(
              `SELECT scanned, brand, name FROM scan_corrections WHERE team_id = $1`, [teamIdC]);
            for (const row of cr.rows) corrections.set(row.scanned, { brand: row.brand, name: row.name });
          } catch { /* table may not exist yet */ }

          for (const group of parsed) {
            if (!Array.isArray(group.products)) continue;
            group.products = group.products.map((p: any) => {
              const literal = `${p.brand || ""} ${p.name || ""}`.trim();
              const learned = corrections.get(norm(literal));
              if (learned) {
                return { skiNumber: p.skiNumber, brand: learned.brand, name: learned.name, matched: true, scannedText: literal };
              }
              const scanned = expandBrandCode(literal);
              if (!scanned) return { ...p, matched: false, scannedText: literal };
              let bestScore = 0;
              let secondScore = 0;
              let bestMatch: { id: number; brand: string; name: string } | null = null;
              for (const dp of dbProducts) {
                const score = matchScore(scanned, `${dp.brand} ${dp.name}`);
                if (score > bestScore) { secondScore = bestScore; bestScore = score; bestMatch = dp; }
                else if (score > secondScore) { secondScore = score; }
              }
              // Require strong containment AND that the match is not ambiguous
              // (clearly better than the runner-up, unless it's a near-perfect match).
              const confident = bestMatch != null && bestScore >= 0.6 &&
                (bestScore >= 0.99 || bestScore - secondScore >= 0.25);
              if (confident && bestMatch) {
                return { brand: bestMatch.brand, name: bestMatch.name, skiNumber: p.skiNumber, matched: true, scannedText: literal };
              }
              // No confident match — keep the transcription (brand code expanded)
              // so "Create product" prefills the real brand, not the paper code.
              const parts = scanned.split(" ");
              const knownBrand = dbBrands.find((b) => b.toLowerCase() === (parts[0] || "").toLowerCase())
                || Object.values(BRAND_CODES).find((b) => b.toLowerCase() === (parts[0] || "").toLowerCase());
              if (knownBrand) {
                return { skiNumber: p.skiNumber, brand: knownBrand, name: parts.slice(1).join(" ") || p.name || "", matched: false, scannedText: literal };
              }
              return { ...p, matched: false, scannedText: literal };
            });
          }
        } else {
          // No products in DB yet — nothing matched
          for (const group of parsed) {
            if (Array.isArray(group.products)) {
              group.products = group.products.map((p: any) => ({ ...p, matched: false }));
            }
          }
        }

        return res.json(parsed);
      } catch {
        return res.status(500).json({ message: "Failed to parse AI response", raw: text.slice(0, 500) });
      }
    } catch (e: any) {
      return res.status(500).json({ message: e.message || "Failed to analyze image" });
    }
  });

  // POST /api/tests/from-picture/create — create series/products/weather/test from analyzed data
  app.post("/api/tests/from-picture/create", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (u.permissions.tests === "none" && !u.isAdmin && !u.isTeamAdmin) {
      return res.status(403).json({ message: "No access" });
    }
    const teamId = getActiveTeamId(req);
    const groupScope = resolveCreateGroupScope(req);
    const now = new Date().toISOString();
    const { pool } = await import("./db");
    const body = req.body as {
      date: string;
      location: string;
      testType: string;
      testName?: string | null;
      seriesName?: string | null;
      notes?: string | null;
      weather?: Record<string, any> | null;
      products?: Array<{ skiNumber: number; category: string; brand: string; name: string; scannedText?: string | null }>;
      entries?: Array<Record<string, any>>;
      distanceLabels?: string[] | null;
    };

    // ── Competition ranking helper (dense competition style: 1,1,3) ──────────
    const competitionRanks = (vals: Array<{ key: number; v: number }>): Map<number, number> => {
      const sorted = [...vals].sort((a, b) => a.v - b.v);
      const ranks = new Map<number, number>();
      let prev: number | null = null;
      let currentRank = 1;
      for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        if (prev !== null && item.v !== prev) currentRank = i + 1;
        ranks.set(item.key, currentRank);
        prev = item.v;
      }
      return ranks;
    };

    // Determine number of rounds from the entries' results arrays
    const numRounds = Math.max(
      1,
      ...(body.entries || []).map((e: any) => Array.isArray(e.results) ? e.results.length : 1)
    );

    // Compute ranks per round across all entries (server is source of truth)
    const computedRanksPerRound: Array<Map<number, number>> = [];
    for (let r = 0; r < numRounds; r++) {
      const vals: Array<{ key: number; v: number }> = [];
      (body.entries || []).forEach((e: any, idx: number) => {
        const result = Array.isArray(e.results)
          ? (e.results[r]?.result ?? null)
          : (r === 0 ? (e.result0kmCmBehind ?? null) : null);
        if (result != null && !isNaN(Number(result))) {
          vals.push({ key: idx, v: Number(result) });
        }
      });
      computedRanksPerRound.push(competitionRanks(vals));
    }

    // 1. Find or create series — use AI-detected series name if provided
    // Picture imports never invent fleets: every scanned test lands in the one
    // placeholder fleet, regardless of what the sheet's block was called. The
    // block title (Paraffin, Topping, Blå 1 …) is a fine TEST name instead.
    const SERIES_NAME = "From picture - no series available";
    let seriesId: number;
    const existingSeriesRows = await (pool as any).query(
      `SELECT id FROM test_ski_series WHERE name = $1 AND team_id = $2 AND archived_at IS NULL LIMIT 1`,
      [SERIES_NAME, teamId]
    );
    if (existingSeriesRows.rows.length > 0) {
      seriesId = existingSeriesRows.rows[0].id;
    } else {
      const createdSeries = await storage.createSeries({
        name: SERIES_NAME,
        type: body.testType === "Classic" || body.testType === "Skating" || body.testType === "Double Poling" ? "Classic" : "Glide",
        brand: null,
        skiType: null,
        grind: null,
        numberOfSkis: (() => {
          const el = body.entries || [];
          const maxSki = el.reduce((m: number, e: any) => Math.max(m, e.skiNumber || 0), 0);
          return maxSki > 0 ? maxSki : el.length || 1;
        })(),
        pairLabels: null,
        lastRegrind: null,
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope,
        teamId,
      });
      seriesId = createdSeries.id;
    }

    // Category: structure tests create structure tools; for glide, the sheet
    // is powder unless the name itself says otherwise ("... liquid").
    const categoryFor = (name: string): string => {
      if (body.testType === "Structure") return "Structure tool";
      const n = name.toLowerCase();
      // The sheets abbreviate: "liq." / "liq" mean liquid.
      if (/\bliq(uid)?\.?(\s|$)|\bflytende\b/.test(n)) return "Liquid";
      if (/\bblock\b|\bblokk\b/.test(n)) return "Block";
      if (/\bparaffin\b/.test(n)) return "Paraffin";
      return "Powder";
    };

    // Helper: normalize a string for matching (collapse whitespace, lowercase)
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

    // 2. Find or create each product, then resolve which entries get which products
    const findOrCreateProduct = async (brand: string, name: string): Promise<number> => {
      const normBrand = normalize(brand);
      const normName  = normalize(name);
      const existingProds = await (pool as any).query(
        `SELECT id FROM products
         WHERE LOWER(REGEXP_REPLACE(brand, '\\s+', ' ', 'g')) = $1
           AND LOWER(REGEXP_REPLACE(name,  '\\s+', ' ', 'g')) = $2
           AND team_id = $3
         LIMIT 1`,
        [normBrand, normName, teamId]
      );
      if (existingProds.rows.length > 0) return existingProds.rows[0].id;
      const created = await storage.createProduct({
        category: categoryFor(name),
        brand: brand.trim().replace(/\s+/g, " "),
        name: name.trim().replace(/\s+/g, " "),
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope,
        teamId,
      });
      return created.id;
    };

    // Step 1: resolve all products and record their skiNumber (null if missing/invalid)
    type ResolvedProduct = { skiNumber: number | null; productId: number };
    const resolvedProducts: ResolvedProduct[] = [];
    for (const p of (body.products || [])) {
      if (!p.brand || !p.name) continue;
      const productId = await findOrCreateProduct(p.brand, p.name);
      const raw = Number(p.skiNumber);
      const skiNumber = (!isNaN(raw) && raw > 0) ? raw : null;
      resolvedProducts.push({ skiNumber, productId });

      // The learning loop: whatever the sheet said, the product the user saved
      // with IS the right answer for that transcription. Remembered per team
      // and applied as an exact match on every later scan — the same
      // handwriting quirk is never mis-read twice.
      const scanned = String(p.scannedText ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      if (scanned) {
        try {
          await (pool as any).query(
            `INSERT INTO scan_corrections (team_id, scanned, brand, name, hits, updated_at)
             VALUES ($1, $2, $3, $4, 1, $5)
             ON CONFLICT (team_id, scanned) DO UPDATE SET brand = $3, name = $4,
               hits = scan_corrections.hits + 1, updated_at = $5`,
            [teamId, scanned, p.brand.trim(), p.name.trim(), now]);
        } catch (e) { console.error("[from-picture] correction save failed:", e); }
      }
    }

    // Step 2: group by skiNumber → entryProductsMap (entry skiNum → [primaryId, ...additionalIds])
    // Only include entries that had a valid skiNumber from the AI
    const entryProductsMap = new Map<number, number[]>();
    for (const rp of resolvedProducts) {
      if (rp.skiNumber === null) continue;
      const list = entryProductsMap.get(rp.skiNumber) ?? [];
      if (!list.includes(rp.productId)) list.push(rp.productId);
      entryProductsMap.set(rp.skiNumber, list);
    }

    const sortedEntries = [...(body.entries || [])].sort((a: any, b: any) => Number(a.skiNumber) - Number(b.skiNumber));

    // Step 3: check how many actual entry skiNumbers appear in entryProductsMap
    const assignedCount = sortedEntries.filter((e: any) => entryProductsMap.has(Number(e.skiNumber))).length;

    if (assignedCount === 0 && resolvedProducts.length > 0) {
      // No entry ski numbers matched any product ski number → positional fallback.
      // Group consecutive products (preserving combined-product order) into position slots.
      const posSlots: number[][] = [];
      let lastSki: number | null | undefined = undefined;
      for (const rp of resolvedProducts) {
        if (rp.skiNumber !== lastSki) {
          posSlots.push([rp.productId]);
          lastSki = rp.skiNumber;
        } else {
          if (!posSlots[posSlots.length - 1].includes(rp.productId))
            posSlots[posSlots.length - 1].push(rp.productId);
        }
      }
      sortedEntries.forEach((e: any, i: number) => {
        const slot = posSlots[i] ?? posSlots[posSlots.length - 1];
        if (slot?.length) entryProductsMap.set(Number(e.skiNumber), [...slot]);
      });
    } else if (assignedCount < sortedEntries.length) {
      // Some entries matched, others didn't.
      // If there is only ONE unique product across everything → broadcast to unassigned.
      const uniqueIds = [...new Set(resolvedProducts.map((r) => r.productId))];
      if (uniqueIds.length === 1) {
        for (const e of sortedEntries) {
          const skiNum = Number(e.skiNumber);
          if (!entryProductsMap.has(skiNum)) entryProductsMap.set(skiNum, [uniqueIds[0]]);
        }
      }
    }

    // 3. Create weather only if the user kept/confirmed weather data in review.
    // The client sends weather: null when the user doesn't want a weather record;
    // when the image clearly contains weather (other sheet layouts), it is passed
    // through and created here, linked to the test.
    let weatherId: number | null = null;
    const w = body.weather;
    if (w && (w.airTemperatureC != null || w.snowTemperatureC != null ||
              w.airHumidityPct != null || w.snowHumidityPct != null)) {
      const createdWeather = await storage.createWeather({
        date: body.date,
        time: w.time?.trim() || "",
        location: body.location?.trim() || "Unknown",
        airTemperatureC: w.airTemperatureC ?? 0,
        snowTemperatureC: w.snowTemperatureC ?? 0,
        airHumidityPct: w.airHumidityPct ?? null,
        snowHumidityPct: w.snowHumidityPct ?? null,
        clouds: w.clouds ?? null,
        visibility: w.visibility?.trim() || null,
        wind: w.wind?.trim() || null,
        precipitation: w.precipitation?.trim() || null,
        artificialSnow: w.artificialSnow || null,
        naturalSnow: w.naturalSnow || null,
        grainSize: w.grainSize || null,
        snowHumidityType: w.snowHumidityType || null,
        trackHardness: w.trackHardness || null,
        testQuality: w.testQuality ?? null,
        snowType: w.snowType?.trim() || null,
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope,
        teamId,
      });
      weatherId = createdWeather.id;
    }

    // 4. Build distance labels for multi-round tests
    let distanceLabel0km: string | null = null;
    let distanceLabelXkm: string | null = null;
    let distanceLabelsJson: string | null = null;
    if (numRounds > 1) {
      const labels = (Array.isArray(body.distanceLabels) && body.distanceLabels.length === numRounds)
        ? body.distanceLabels
        : Array.from({ length: numRounds }, (_, i) => i === 0 ? "Round 1" : `Round ${i + 1}`);
      distanceLabel0km = labels[0] ?? null;
      distanceLabelXkm = labels[1] ?? null;
      distanceLabelsJson = JSON.stringify(labels);
    }

    // 5. Create test
    const test = await storage.createTest({
      date: body.date,
      location: body.location?.trim() || "Unknown",
      testName: body.testName?.trim() || body.seriesName?.trim() || null,
      weatherId,
      testType: body.testType || "Glide",
      seriesId,
      athleteId: null,
      testSkiSource: "series",
      notes: body.notes?.trim() || null,
      distanceLabel0km,
      distanceLabelXkm,
      distanceLabels: distanceLabelsJson,
      grindParameters: null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });

    // 6. Create entries — with computed ranks per round
    for (let idx = 0; idx < (body.entries || []).length; idx++) {
      const e: any = body.entries![idx];
      const skiNum = Number(e.skiNumber);
      const allPids = entryProductsMap.get(skiNum) ?? [];
      const primaryId = allPids[0] ?? null;
      const additionalIds = allPids.length > 1 ? allPids.slice(1).join(",") : null;

      // Build per-round results with computed ranks
      const roundResults: Array<{ result: number | null; rank: number | null }> = [];
      for (let r = 0; r < numRounds; r++) {
        const rawResult = Array.isArray(e.results)
          ? (e.results[r]?.result ?? null)
          : (r === 0 ? (e.result0kmCmBehind ?? null) : null);
        const result = rawResult != null && !isNaN(Number(rawResult)) ? Number(rawResult) : null;
        const rank = result != null ? (computedRanksPerRound[r]?.get(idx) ?? null) : null;
        roundResults.push({ result, rank });
      }

      await storage.createEntry({
        testId: test.id,
        skiNumber: e.skiNumber,
        productId: primaryId,
        freeTextProduct: null,
        additionalProductIds: additionalIds,
        methodology: e.methodology || "",
        result0kmCmBehind: roundResults[0]?.result ?? null,
        rank0km: roundResults[0]?.rank ?? null,
        resultXkmCmBehind: roundResults[1]?.result ?? null,
        rankXkm: roundResults[1]?.rank ?? null,
        results: numRounds > 1 ? JSON.stringify(roundResults) : null,
        feelingRank: e.feelingRank ?? null,
        kickRank: e.kickRank ?? null,
        grindType: e.grindType || null,
        grindStone: e.grindStone || null,
        grindPattern: e.grindPattern || null,
        grindExtraParams: e.grindExtraParams || null,
        raceSkiId: null,
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope,
        teamId,
      });
    }

    try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "test", entityId: test.id,
        details: `Test from picture: ${body.testType} on ${body.date}`,
        createdAt: now, groupScope, teamId,
      });
    } catch (_) {}

    return res.json({ testId: test.id, seriesId, weatherId, productIds: Object.fromEntries(entryProductsMap) });
  });

  // PUT /api/inbox/:id/read — mark a message as read
  app.put("/api/inbox/:id/read", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const msgId = parseInt(req.params.id, 10);
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE inbox_messages SET is_read = 1 WHERE id = $1 AND to_user_id = $2`,
      [msgId, userId]
    );
    return res.json({ ok: true });
  });

  // PUT /api/inbox/read-all — mark all messages as read for current user
  app.put("/api/inbox/read-all", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE inbox_messages SET is_read = 1 WHERE to_user_id = $1`,
      [userId]
    );
    return res.json({ ok: true });
  });

  // DELETE /api/inbox/:id — delete a message (only if it belongs to current user)
  app.delete("/api/inbox/:id", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const msgId = parseInt(req.params.id, 10);
    const { pool } = await import("./db");
    await (pool as any).query(
      `DELETE FROM inbox_messages WHERE id = $1 AND to_user_id = $2`,
      [msgId, userId]
    );
    return res.json({ ok: true });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ── Billing (Stripe) ──────────────────────────────────────────────────────

  const billing = await import("./stripe");

  // Webhook must receive raw body — register before express.json() parses it
  app.post(
    "/api/billing/webhook",
    (req, res, next) => {
      // express.raw() is applied in vite.ts / index.ts; if already raw, skip
      next();
    },
    billing.handleWebhook,
  );

  app.get("/api/billing/status", requireAuth, billing.getBillingStatus);

  app.post("/api/billing/checkout", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Only team admins can manage billing" });
    return billing.createCheckout(req, res);
  });

  app.post("/api/billing/portal", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Only team admins can manage billing" });
    return billing.createPortalSession(req, res);
  });

  // POST /api/account/delete — GDPR: delete own data
  app.post("/api/account/delete", requireAuth, async (req, res) => {
    const u = req.user as any;
    const { pool } = await import("./db");
    // Anonymise user data rather than hard-delete to preserve referential integrity
    await (pool as any).query(
      `UPDATE users SET
         email = $1,
         password = 'DELETED',
         name = 'Deleted User',
         is_active = 0,
         watch_code = NULL,
         onboarding_completed = 0
       WHERE id = $2`,
      [`deleted+${u.id}@glidr.io`, u.id]
    );
    req.logout(() => {
      res.json({ ok: true });
    });
  });

  // PATCH /api/account/onboarding — mark onboarding as complete
  app.patch("/api/account/onboarding", requireAuth, async (req, res) => {
    const u = req.user as any;
    await db.update(users).set({ onboardingCompleted: 1 } as any).where(eq(users.id, u.id));
    res.json({ ok: true });
  });

  // --- Interest registrations (public sign-up form) ---
  // interest form rate limit
  const interestFormLimit = rateLimit({ windowMs: 60*60*1000, max: 10, message: { message: "Too many submissions." } });
  app.post("/api/interest", interestFormLimit, async (req, res) => {
    const { contactName, email, phone, teamName, planName, userCount, groupCount, billingPeriod, invoiceAddress, notes } = req.body;
    if (!contactName || !email || !teamName) return res.status(400).json({ message: "contactName, email, and teamName are required" });
    const now = new Date().toISOString();
    await db.execute(sql`
      INSERT INTO interest_registrations (created_at, contact_name, email, phone, team_name, plan_name, user_count, group_count, billing_period, invoice_address, notes, status)
      VALUES (${now}, ${contactName}, ${email}, ${phone ?? null}, ${teamName}, ${planName ?? "team"}, ${userCount ?? null}, ${groupCount ?? null}, ${billingPeriod ?? "monthly"}, ${invoiceAddress ?? null}, ${notes ?? null}, 'new')
    `);
    // Notify all super admins via inbox
    try {
      const saUsers = await db.execute(sql`SELECT id FROM users WHERE is_admin = 1`);
      const rows = (saUsers as any).rows ?? saUsers;
      const inboxNow = new Date().toISOString();
      for (const sa of rows) {
        await db.execute(sql`
          INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at)
          VALUES (${sa.id}, 'Glidr System', ${'Ny registrering: ' + teamName},
            ${'Ny interesseregistrering fra ' + contactName + ' (' + email + ') for teamet «' + teamName + '». Plan: ' + (planName ?? 'team') + '. Se Admin → Registreringer for detaljer.'},
            0, ${inboxNow})
        `);
      }
    } catch (e) { /* inbox notification best-effort */ }
    // Send email notification to owner
    sendInterestNotification({ contactName, email, phone, teamName, planName, userCount, billingPeriod, notes }).catch(() => {});
    res.json({ ok: true });
  });

  // --- Self-service team signup (plan builder) ---
  // Public: a new customer composes their own plan (features + limits), accepts
  // billing, and gets a real team with themselves as Team Admin & contact person.
  // Only available while the SA commercialization toggle is ON — enforced here,
  // not just in the UI. Price is recomputed server-side from shared/pricing.
  const selfSignupLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { message: "Too many signup attempts. Try again later." } });
  app.post("/api/signup/self-service", selfSignupLimit, async (req, res) => {
    try {
      const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'commercialization_enabled'`);
      const row = ((rows as any).rows ?? rows)[0];
      if (row?.value === "false") return res.status(403).json({ message: "Self-service signup is not available" });
    } catch { /* default open, same as /api/settings/public */ }

    const { teamName, contactName, email, password, features, maxUsers, maxGroups, billingPeriod, acceptBilling } = req.body;
    if (!teamName?.trim() || !contactName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "teamName, contactName, email and password are required" });
    }
    if (acceptBilling !== true) return res.status(400).json({ message: "You must accept that usage will be invoiced" });
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ message: pwError });
    const existing = await storage.getUserByEmail(email.trim().toLowerCase());
    if (existing) return res.status(409).json({ message: "Email already in use" });

    // Authoritative price & config — never trust the client's number. Uses the
    // same SA pricing overrides the public builder displays.
    const { computeCustomPrice, sanitizeFeatureSelection, clampLimit } = await import("@shared/pricing");
    let pricingOverrides: any = null;
    try {
      const povRows = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'plan_builder_pricing'`);
      const povRow = ((povRows as any).rows ?? povRows)[0];
      if (povRow?.value) pricingOverrides = JSON.parse(povRow.value);
    } catch { /* defaults */ }
    const chosenFeatures = sanitizeFeatureSelection(features);
    const cfg = {
      features: chosenFeatures,
      maxUsers: clampLimit("users", Number(maxUsers)),
      maxGroups: clampLimit("groups", Number(maxGroups)),
      billingPeriod: billingPeriod === "annual" ? "annual" as const : "monthly" as const,
    };
    const price = computeCustomPrice(cfg, pricingOverrides);
    const now = new Date().toISOString();

    // 1) The team — enabled areas exactly as composed, limits as chosen.
    const team = await storage.createTeam({
      name: teamName.trim(),
      createdAt: now,
      enabledAreas: JSON.stringify(chosenFeatures),
      planName: "custom",
      customPrice: price.monthlyTotal,
      billingPeriod: cfg.billingPeriod,
      maxUsers: cfg.maxUsers,
      maxGroups: cfg.maxGroups,
      timezone: (() => {
        const tz = String(req.body.timezone ?? "");
        try { if (tz) { new Date().toLocaleString("sv-SE", { timeZone: tz }); return tz; } } catch {}
        return "Europe/Oslo";
      })(),
      notes: `Self-service signup ${now} — contact: ${contactName.trim()} <${email.trim().toLowerCase()}>. Accepted billing: ${price.periodTotal} NOK/${cfg.billingPeriod === "annual" ? "yr" : "mo"} (monthly base ${price.monthlyTotal} NOK).`,
    } as any);

    // 2) The first user — Team Admin and contact person.
    const emailNorm = email.trim().toLowerCase();
    let usernameToSet = emailNorm.split("@")[0].replace(/[^a-z0-9._-]/g, "") || "user";
    const { pool: pgSignup } = await import("./db");
    let finalUsername = usernameToSet;
    let suffix = 2;
    while (true) {
      const existingUn = await (pgSignup as any).query(`SELECT id FROM users WHERE LOWER(username) = $1`, [finalUsername]);
      if (existingUn.rows.length === 0) break;
      finalUsername = `${usernameToSet}${suffix++}`;
    }
    const allEdit = Object.fromEntries(PERMISSION_AREAS.map((a) => [a, "edit"]));
    const created = await storage.createUser({
      email: emailNorm,
      password: await hashPassword(password),
      name: contactName.trim(),
      username: finalUsername,
      groupScope: "",
      isAdmin: 0,
      isTeamAdmin: 1,
      permissions: JSON.stringify(allEdit),
      teamId: team.id,
      isBlindTester: 0,
      language: req.body.language === "en" ? "en" : "no",
      createdAt: now,
    } as any);

    // 3) Visibility for the SA: registration row (existing Registrations tab),
    // inbox message, and an activity-log entry on the new team.
    await db.execute(sql`
      INSERT INTO interest_registrations (created_at, contact_name, email, phone, team_name, plan_name, user_count, group_count, billing_period, invoice_address, notes, status)
      VALUES (${now}, ${contactName.trim()}, ${emailNorm}, ${req.body.phone ?? null}, ${teamName.trim()}, 'custom (self-service)', ${cfg.maxUsers}, ${cfg.maxGroups}, ${cfg.billingPeriod}, ${req.body.invoiceAddress ?? null},
        ${`Self-service: team #${team.id} created automatically. ${price.monthlyTotal} NOK/mo (${price.periodTotal} NOK/${cfg.billingPeriod === "annual" ? "yr" : "mo"}). Features: ${chosenFeatures.join(", ")}`}, 'converted')
    `).catch(() => {});
    try {
      const saUsers = await db.execute(sql`SELECT id FROM users WHERE is_admin = 1`);
      for (const sa of ((saUsers as any).rows ?? saUsers)) {
        await db.execute(sql`
          INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at)
          VALUES (${sa.id}, 'Glidr System', ${"Nytt lag opprettet (selvbetjening): " + teamName.trim()},
            ${`${contactName.trim()} (${emailNorm}) opprettet laget «${teamName.trim()}» via selvbetjening. Pris: ${price.monthlyTotal} NOK/mnd (${cfg.billingPeriod}). Brukergrense: ${cfg.maxUsers}, grupper: ${cfg.maxGroups}. Fakturering er akseptert. Se Admin → Teams.`},
            0, ${now})
        `);
      }
    } catch { /* best-effort */ }
    await storage.createActivityLog({
      userId: created.id, userName: created.name, action: "team_signup",
      entityType: "team", entityId: team.id,
      details: `Team created via self-service signup — billing accepted (${price.monthlyTotal} NOK/mo, ${cfg.billingPeriod})`,
      createdAt: now, groupScope: "", teamId: team.id,
    } as any).catch(() => {});

    sendWelcomeEmail(created.email, created.name, created.language ?? "no").catch(() => {});
    res.json({ ok: true, teamId: team.id, username: finalUsername });
  });

  app.get("/api/admin/registrations", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const rows = await db.execute(sql`SELECT * FROM interest_registrations ORDER BY created_at DESC`);
    res.json((rows as any).rows ?? rows);
  });

  app.patch("/api/admin/registrations/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const id = parseInt(req.params.id);
    const { status, adminNotes } = req.body;
    const validStatuses = ["new", "contacted", "active", "rejected", "converted"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    await db.execute(sql`
      UPDATE interest_registrations SET status = ${status ?? null}, admin_notes = ${adminNotes ?? null} WHERE id = ${id}
    `);
    res.json({ ok: true });
  });

  // #31: delete a registration after it has been followed up.
  app.delete("/api/admin/registrations/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const id = parseInt(req.params.id);
    await db.execute(sql`DELETE FROM interest_registrations WHERE id = ${id}`);
    res.json({ ok: true });
  });

  // --- Plan change request (team admin) ---
  app.post("/api/account/plan-change-request", requireAuth, async (req, res) => {
    const u = req.user!;
    const isTeamAdmin = (u as any).isTeamAdmin === 1;
    if (u.isAdmin !== 1 && !isTeamAdmin) return res.status(403).json({ message: "Team admin only" });
    const { requestedPlan, billingPeriod, notes } = req.body;
    if (!requestedPlan) return res.status(400).json({ message: "requestedPlan is required" });
    const team = await storage.getTeam(u.teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });
    // Notify all super admins
    try {
      const saUsers = await db.execute(sql`SELECT id FROM users WHERE is_admin = 1`);
      const rows = (saUsers as any).rows ?? saUsers;
      const now = new Date().toISOString();
      for (const sa of rows) {
        await db.execute(sql`
          INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at, team_name)
          VALUES (${sa.id}, ${u.name ?? u.email}, ${'Planendring: ' + team.name},
            ${'Team «' + team.name + '» (admin: ' + (u.name ?? u.email) + ') ønsker å bytte til plan «' + requestedPlan + '».' + (billingPeriod ? ' Fakturering: ' + billingPeriod + '.' : '') + (notes ? ' Merknad: ' + notes : '')},
            0, ${now}, ${team.name})
        `);
      }
    } catch(e) { /* best-effort */ }
    res.json({ ok: true });
  });

  // ──────────────────────────────────────────────────────────────────────────

  // ── In-app password reset request (no email needed) ────────────────────────
  const inAppResetLimit = rateLimit({ windowMs: 15*60*1000, max: 10, message: { message: "Too many requests." } });

  app.post("/api/auth/request-password-reset", inAppResetLimit, async (req, res) => {
    // Always return success — never reveal if email/user exists
    const { email } = req.body;
    if (!email) return res.json({ ok: true });
    try {
      const { pool } = await import("./db");
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) return res.json({ ok: true });

      const now = new Date().toISOString();
      const subject = `Password reset request — ${user.name ?? user.email}`;
      const body = `${user.name ?? user.email} (${user.email}) has requested a password reset for their Glidr account.\n\nGo to your Inbox and click "Reset password" to set a new temporary password, then share it with the user.`;
      const actionData = JSON.stringify({ userId: user.id, userName: user.name ?? user.email, userEmail: user.email });

      // Notify all Super Admins
      const saRows = await (pool as any).query(`SELECT id FROM users WHERE is_admin = 1`);
      for (const sa of saRows.rows) {
        await (pool as any).query(
          `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at, action_type, action_data)
           VALUES ($1, $2, $3, $4, 0, $5, 'reset_password', $6)`,
          [sa.id, user.name ?? user.email, subject, body, now, actionData]
        );
      }

      // Notify Team Admins in the same team
      if (user.teamId) {
        const taRows = await (pool as any).query(
          `SELECT utp.user_id FROM user_team_permissions utp
           WHERE utp.team_id = $1 AND utp.is_team_admin = 1`,
          [user.teamId]
        );
        for (const ta of taRows.rows) {
          // Don't double-notify if TA is also SA
          const alreadyNotified = saRows.rows.some((sa: any) => sa.id === ta.user_id);
          if (alreadyNotified) continue;
          await (pool as any).query(
            `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at, action_type, action_data)
             VALUES ($1, $2, $3, $4, 0, $5, 'reset_password', $6)`,
            [ta.user_id, user.name ?? user.email, subject, body, now, actionData]
          );
        }
      }
    } catch (e) {
      console.error("[request-password-reset]", e);
    }
    return res.json({ ok: true });
  });

  // ── Password Reset ──────────────────────────────────────────────────────────
  const pwResetLimit = rateLimit({ windowMs: 60*60*1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { message: "Too many password reset requests. Try again in an hour." } });

  app.post("/api/auth/forgot-password", pwResetLimit, async (req, res) => {
    // Always return success — never reveal if email exists
    const { email } = req.body;
    if (!email) return res.json({ ok: true });
    try {
      const user = await storage.getUserByEmail(email);
      if (user) {
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const now = new Date().toISOString();
        // Invalidate existing tokens for this user
        await db.execute(sql`UPDATE password_reset_tokens SET used = 1 WHERE user_id = ${user.id} AND used = 0`);
        await db.execute(sql`
          INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used, created_at)
          VALUES (${user.id}, ${tokenHash}, ${expiresAt}, 0, ${now})
        `);
        const appUrl = process.env.APP_URL || "https://glidr.no";
        await sendPasswordResetEmail(user.email, user.name, `${appUrl}/reset-password?token=${rawToken}`, user.language ?? "no");
      }
    } catch (e) {
      console.error("[forgot-password] ERROR:", e);
    }
    return res.json({ ok: true });
  });

  app.get("/api/auth/reset-password/validate", async (req, res) => {
    const token = req.query.token;
    if (!token || typeof token !== "string") return res.json({ valid: false });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date().toISOString();
    const rows = await db.execute(sql`
      SELECT id FROM password_reset_tokens
      WHERE token_hash = ${tokenHash} AND used = 0 AND expires_at > ${now} LIMIT 1
    `);
    const record = ((rows as any).rows ?? rows)[0];
    res.json({ valid: !!record });
  });

  app.post("/api/auth/reset-password", pwResetLimit, async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password are required." });
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ message: pwErr });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date().toISOString();
    // Atomisk: merk som brukt og hent user_id i én operasjon — hindrer race-condition
    const rows = await db.execute(sql`
      UPDATE password_reset_tokens SET used = 1
      WHERE token_hash = ${tokenHash} AND used = 0 AND expires_at > ${now}
      RETURNING id, user_id
    `);
    const record = ((rows as any).rows ?? rows)[0];
    if (!record) return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
    // Update password + unlock account
    const hashed = await hashPassword(password);
    await db.execute(sql`
      UPDATE users SET password = ${hashed}, failed_attempts = 0, login_locked = 0 WHERE id = ${record.user_id}
    `);
    // Invalidate all existing sessions for security
    try {
      await db.execute(sql`
        DELETE FROM user_sessions
        WHERE sess::jsonb -> 'passport' ->> 'user' = ${String(record.user_id)}
      `);
    } catch {}
    res.json({ ok: true });
  });

  // ── TOTP / 2FA ─────────────────────────────────────────────────────────────
  const twoFaLimit = rateLimit({ windowMs: 15*60*1000, max: 10, message: { message: "Too many 2FA attempts." } });

  app.get("/api/auth/2fa/status", requireAuth, async (req, res) => {
    const u = req.user!;
    const rows = await db.execute(sql`SELECT totp_enabled, totp_secret FROM users WHERE id = ${u.id}`);
    const row = ((rows as any).rows ?? rows)[0];
    res.json({ enabled: row?.totp_enabled === 1, hasSecret: !!row?.totp_secret });
  });

  app.get("/api/auth/2fa/setup", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const secret = generateTotpSecret();
    const otpauthUri = getTotpUri(u.email, "Glidr", secret);
    const qrDataUrl = await generateQrDataUrl(otpauthUri);
    (req.session as any).pendingTotpSecret = secret;
    await new Promise<void>((resolve) => req.session.save(() => resolve()));
    res.json({ qrDataUrl, secret, manualEntry: secret });
  });

  app.post("/api/auth/2fa/enable", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const { code } = req.body;
    const secret = (req.session as any).pendingTotpSecret;
    if (!secret) return res.status(400).json({ message: "No pending 2FA setup. Please start setup again." });
    if (!verifyTotp(String(code), secret)) return res.status(400).json({ message: "Invalid code. Check your authenticator app and try again." });
    const { plain, hashed } = generateBackupCodes();
    await db.execute(sql`
      UPDATE users SET totp_secret = ${secret}, totp_enabled = 1, totp_backup_codes = ${JSON.stringify(hashed)}
      WHERE id = ${u.id}
    `);
    delete (req.session as any).pendingTotpSecret;
    await new Promise<void>((resolve) => req.session.save(() => resolve()));
    res.json({ ok: true, backupCodes: plain });
  });

  app.post("/api/auth/2fa/disable", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super Admin only" });
    const { password, code } = req.body;
    if (!password) return res.status(400).json({ message: "Current password is required." });
    const userRows = await db.execute(sql`SELECT password, totp_secret, totp_enabled FROM users WHERE id = ${u.id}`);
    const userRow = ((userRows as any).rows ?? userRows)[0];
    if (!userRow) return res.status(404).json({ message: "User not found" });
    const validPw = await verifyPassword(password, userRow.password);
    if (!validPw) return res.status(401).json({ message: "Invalid password." });
    if (userRow.totp_enabled === 1 && userRow.totp_secret && code) {
      if (!verifyTotp(String(code), userRow.totp_secret)) {
        return res.status(401).json({ message: "Invalid 2FA code." });
      }
    }
    await db.execute(sql`
      UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_backup_codes = NULL WHERE id = ${u.id}
    `);
    res.json({ ok: true });
  });

  app.post("/api/auth/2fa/login-verify", twoFaLimit, async (req, res, next) => {
    const pendingUserId = (req.session as any).pending2faUserId;
    if (!pendingUserId) return res.status(400).json({ message: "No pending 2FA verification. Please log in again." });
    // Sjekk at 2FA-pendingen ikke er utløpt (maks 10 minutter)
    const pendingAt = (req.session as any).pending2faAt;
    if (!pendingAt || Date.now() - pendingAt > 10 * 60 * 1000) {
      delete (req.session as any).pending2faUserId;
      delete (req.session as any).pending2faAt;
      return res.status(400).json({ message: "2FA session expired. Please log in again." });
    }
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Verification code is required." });
    const userRows = await db.execute(sql`
      SELECT * FROM users WHERE id = ${pendingUserId} LIMIT 1
    `);
    const userRow = ((userRows as any).rows ?? userRows)[0];
    if (!userRow) return res.status(401).json({ message: "Session expired. Please log in again." });

    let verified = false;
    // Try TOTP
    if (userRow.totp_secret && verifyTotp(String(code), userRow.totp_secret)) {
      verified = true;
    }
    // Try backup code
    if (!verified && userRow.totp_backup_codes) {
      let hashes: string[] = [];
      try { hashes = JSON.parse(userRow.totp_backup_codes); } catch {}
      const result = verifyBackupCode(String(code), hashes);
      if (result.valid) {
        verified = true;
        await db.execute(sql`UPDATE users SET totp_backup_codes = ${JSON.stringify(result.remaining)} WHERE id = ${pendingUserId}`);
      }
    }
    if (!verified) return res.status(401).json({ message: "Invalid code. Try again or use a backup code." });

    const rememberMe = !!(req.session as any).pending2faRememberMe;
    delete (req.session as any).pending2faUserId;
    delete (req.session as any).pending2faRememberMe;

    const user = await storage.getUser(pendingUserId);
    if (!user) return res.status(401).json({ message: "User not found." });

    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => {
        if (err) { reject(err); return; }
        // Set remember-me maxAge BEFORE logIn so passport's internal session.save()
        // persists the 3-day expiry to the Postgres session store (see auth.ts login).
        if (rememberMe) req.session.cookie.maxAge = 3 * 24 * 60 * 60 * 1000;
        resolve();
      })
    );

    await new Promise<void>((resolve, reject) =>
      req.logIn(user as any, async (loginErr) => {
        if (loginErr) { reject(loginErr); return; }
        (req.session as any).ipAddress = req.headers["x-forwarded-for"]
          ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
          : req.socket.remoteAddress || "unknown";
        (req.session as any).userAgent = req.headers["user-agent"] || "unknown";
        (req.session as any).loginAt = new Date().toISOString();
        try {
          const ip = req.headers["x-forwarded-for"]
            ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
            : req.socket.remoteAddress || "unknown";
          await storage.createLoginLog({ userId: user.id, email: user.email, name: user.name, loginAt: new Date().toISOString(), ipAddress: ip });
        } catch {}
        resolve();
      })
    );

    const { password, ...safe } = user;
    const perms = parsePermissions(safe.permissions, !!safe.isAdmin, safe.isTeamAdmin === 1);
    return res.json({ ...safe, parsedPermissions: perms });
  });

  // ── Team Invitations ──────────────────────────────────────────────────────────

  // POST /api/invitations — send an invitation (team admin or SA only)
  app.post("/api/invitations", requireAuth, async (req: Request, res: Response) => {
    const u = req.user as any;
    if (!canManageTeam(req)) {
      return res.status(403).json({ message: "Team admin access required." });
    }
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ message: "Valid email required." });
    }
    const teamId: number = u.activeTeamId || u.teamId;
    try {
      const { pool } = await import("./db");
      // Check for existing un-accepted, non-expired invite
      const existing = await pool.query(
        `SELECT id FROM invitations WHERE team_id = $1 AND email = $2 AND accepted_at IS NULL AND expires_at > $3`,
        [teamId, email.toLowerCase(), new Date().toISOString()]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: "An active invitation for this email already exists." });
      }
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const createdAt = new Date().toISOString();
      await pool.query(
        `INSERT INTO invitations (team_id, email, token, invited_by_id, invited_by_name, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [teamId, email.toLowerCase(), token, u.id, u.name, expiresAt, createdAt]
      );
      const team = await storage.getTeam(teamId);
      const teamName = team?.name || "your team";
      const lang = req.body.lang || u.language || "no";
      const appUrl = process.env.APP_URL || "https://glidr.no";
      await sendInvitationEmail(email.toLowerCase(), teamName, u.name, `${appUrl}/invite/${token}`, lang);
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[invitations] POST error:", e);
      return res.status(500).json({ message: "Failed to send invitation." });
    }
  });

  // GET /api/invitations/verify/:token — public, no auth required
  app.get("/api/invitations/verify/:token", async (req: Request, res: Response) => {
    const { token } = req.params;
    try {
      const { pool } = await import("./db");
      const result = await pool.query(
        `SELECT i.*, t.name AS team_name FROM invitations i
         LEFT JOIN teams t ON t.id = i.team_id
         WHERE i.token = $1`,
        [token]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      const inv = result.rows[0];
      if (inv.accepted_at) {
        return res.status(409).json({ message: "Invitation already used" });
      }
      if (new Date(inv.expires_at) < new Date()) {
        return res.status(410).json({ message: "Invitation expired" });
      }
      return res.json({
        email: inv.email,
        teamId: inv.team_id,
        teamName: inv.team_name,
        invitedByName: inv.invited_by_name,
      });
    } catch (e: any) {
      console.error("[invitations] verify error:", e);
      return res.status(500).json({ message: "Server error." });
    }
  });

  // POST /api/invitations/accept/:token — accept invitation and create account
  app.post("/api/invitations/accept/:token", async (req: Request, res: Response) => {
    const { token } = req.params;
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: "Name and password are required." });
    }
    const invPwError = validatePassword(password);
    if (invPwError) return res.status(400).json({ message: invPwError });
    try {
      const { pool } = await import("./db");
      const result = await pool.query(
        `SELECT i.*, t.name AS team_name FROM invitations i
         LEFT JOIN teams t ON t.id = i.team_id
         WHERE i.token = $1`,
        [token]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      const inv = result.rows[0];
      if (inv.accepted_at) {
        return res.status(409).json({ message: "Invitation already used" });
      }
      if (new Date(inv.expires_at) < new Date()) {
        return res.status(410).json({ message: "Invitation expired" });
      }
      // Check no existing user with that email
      const existingUser = await storage.getUserByEmail(inv.email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists." });
      }
      const hashed = await hashPassword(password);
      const { DEFAULT_PERMISSIONS } = await import("@shared/schema");
      const newUser = await storage.createUser({
        email: inv.email,
        name,
        password: hashed,
        teamId: inv.team_id,
        isAdmin: 0,
        isTeamAdmin: 0,
        isActive: 1,
        groupScope: "",
        permissions: JSON.stringify(DEFAULT_PERMISSIONS),
        isBlindTester: 0,
        garminWatch: 0,
        failedAttempts: 0,
        loginLocked: 0,
        onboardingCompleted: 0,
        totpEnabled: 0,
        language: "no",
        createdAt: new Date().toISOString(),
      });
      await pool.query(
        `UPDATE invitations SET accepted_at = $1 WHERE token = $2`,
        [new Date().toISOString(), token]
      );
      await sendWelcomeEmail(inv.email, name, "no");
      // Regenerate the session before logging in — a pre-planted session id
      // must never become authenticated (fixation).
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        req.logIn(newUser as any, (err) => {
          if (err) { reject(err); return; }
          resolve();
        });
      });
      const { password: _pw, ...safe } = newUser as any;
      return res.json(safe);
    } catch (e: any) {
      console.error("[invitations] accept error:", e);
      return res.status(500).json({ message: "Failed to create account." });
    }
  });

  // GET /api/invitations — list invitations for team admin
  app.get("/api/invitations", requireAuth, async (req: Request, res: Response) => {
    const u = req.user as any;
    if (!canManageTeam(req)) {
      return res.status(403).json({ message: "Team admin access required." });
    }
    const teamId: number = u.activeTeamId || u.teamId;
    try {
      const { pool } = await import("./db");
      const result = await pool.query(
        `SELECT * FROM invitations WHERE team_id = $1 ORDER BY created_at DESC`,
        [teamId]
      );
      return res.json(result.rows);
    } catch (e: any) {
      console.error("[invitations] GET error:", e);
      return res.status(500).json({ message: "Failed to fetch invitations." });
    }
  });

  // DELETE /api/invitations/:id — revoke invitation
  app.delete("/api/invitations/:id", requireAuth, async (req: Request, res: Response) => {
    const u = req.user as any;
    if (!canManageTeam(req)) {
      return res.status(403).json({ message: "Team admin access required." });
    }
    const teamId: number = u.activeTeamId || u.teamId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id." });
    try {
      const { pool } = await import("./db");
      await pool.query(
        `DELETE FROM invitations WHERE id = $1 AND team_id = $2`,
        [id, teamId]
      );
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[invitations] DELETE error:", e);
      return res.status(500).json({ message: "Failed to delete invitation." });
    }
  });

  return httpServer;
}
