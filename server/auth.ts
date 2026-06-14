// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { type Express, type Request } from "express";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { pool } from "./db";
import { type User, type UserPermissions, DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS } from "@shared/schema";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      name: string;
      groupScope: string;
      isAdmin: number;
      isTeamAdmin: number;
      teamId: number;
      activeTeamId: number | null;
      permissions: string;
      isActive: number;
      isBlindTester: number;
      garminWatch: number;
      password: string;
    }
  }
}

export function parsePermissions(permissionsStr: string | null | undefined, isAdmin: boolean, isTeamAdmin?: boolean): UserPermissions {
  if (isAdmin || isTeamAdmin) return { ...ADMIN_PERMISSIONS };
  try {
    const parsed = JSON.parse(permissionsStr || "{}");
    const merged = { ...DEFAULT_PERMISSIONS, ...parsed };
    for (const key of Object.keys(merged)) {
      if (merged[key] === "view") merged[key] = "edit";
    }
    // raceprepGlide is secure-by-default: a user only sees glide/structure work
    // when it is explicitly granted. (No backfill from raceprep — that would
    // silently expose glide to ski-waxers.)
    return merged;
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

export async function setupAuth(app: Express) {
  // Auth-specific rate limiter (20 req / 15 min per IP)
  const { default: rateLimit } = await import("express-rate-limit");
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Please try again in 15 minutes." },
  });

  await (pool as any).query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
    ) WITH (OIDS=FALSE);
    CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
  `);

  const PgStore = pgSession(session);

  const REMEMBER_ME_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
  const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000;

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) throw new Error("SESSION_SECRET environment variable is required");

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      maxAge: DEFAULT_MAX_AGE,
      secure: process.env.SCREENSHOT_MODE === "1" ? false : true,
      sameSite: process.env.SCREENSHOT_MODE === "1" ? "lax" as const : "none" as const,
      ...(process.env.SCREENSHOT_MODE === "1" ? {} : { partitioned: true }),
    } as any,
    store: new PgStore({
      pool: pool as any,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "username" },
      async (username, password, done) => {
        try {
          const user = (await storage.getUserByUsername(username)) ?? (await storage.getUserByEmail(username));
          if (!user) {
            return done(null, false, { message: "Invalid username or password." });
          }
          if (user.isActive === 0) {
            return done(null, false, { message: "Account is deactivated. Contact your administrator." });
          }
          // Check if account is locked
          if ((user as any).loginLocked === 1) {
            return done(null, false, { message: "Account is locked due to too many failed login attempts. Contact your Team Admin or Super Admin to reset." });
          }
          // Check if team is paused (Super Admins bypass this check)
          if (user.isAdmin !== 1 && user.teamId) {
            const teamRes = await pool.query(
              `SELECT is_paused FROM teams WHERE id = $1`,
              [user.teamId]
            );
            if (teamRes.rows[0]?.is_paused === 1) {
              return done(null, false, { message: "Your team account is currently suspended. Contact your administrator." });
            }
          }
          const valid = await verifyPassword(password, user.password);
          if (!valid) {
            // Increment failed attempts
            const newAttempts = ((user as any).failedAttempts ?? 0) + 1;
            const shouldLock = newAttempts >= 5;
            await pool.query(
              "UPDATE users SET failed_attempts = $1, login_locked = $2 WHERE id = $3",
              [newAttempts, shouldLock ? 1 : 0, user.id]
            );
            if (shouldLock) {
              return done(null, false, { message: "Account locked after 5 failed attempts. Contact your Team Admin or Super Admin to reset." });
            }
            const remaining = 5 - newAttempts;
            return done(null, false, { message: "Invalid email or password." });
          }
          // Successful login — reset failed attempts
          await pool.query(
            "UPDATE users SET failed_attempts = 0, login_locked = 0 WHERE id = $1",
            [user.id]
          );
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.APP_URL ?? ""}/api/auth/google/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(null, false, { message: "No email returned from Google." });
            }
            const user = await storage.getUserByEmail(email);
            if (!user) {
              return done(null, false, { message: "No Glidr account for this Google address. Contact your administrator." });
            }
            if (user.isActive === 0) {
              return done(null, false, { message: "Account is deactivated. Contact your administrator." });
            }
            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || undefined);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/login", authLimit, (req, res, next) => {
    passport.authenticate("local", async (err: any, user: Express.User | false, info: { message: string }) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      // Check if 2FA is required for this user
      const { pool: authPool } = await import("./db");
      const userRow = await authPool.query("SELECT totp_enabled FROM users WHERE id = $1", [user.id]);
      const totpEnabled = userRow.rows[0]?.totp_enabled === 1;

      if (totpEnabled) {
        // Store pending user ID — login will complete after 2FA verification
        (req.session as any).pending2faUserId = user.id;
        (req.session as any).pending2faAt = Date.now(); // brukes for utløpskontroll
        if (req.body.rememberMe) (req.session as any).pending2faRememberMe = true;
        await new Promise<void>((resolve) => req.session.save(() => resolve()));
        return res.status(200).json({ requires2fa: true });
      }

      // No 2FA — regenerate session to prevent fixation, then log in
      req.session.regenerate((regenErr) => {
        if (regenErr) return next(regenErr);
        // Set the 30-day cookie BEFORE req.logIn(): passport 0.7 calls
        // req.session.save() internally during logIn, and connect-pg-simple writes
        // the session row's `expire` from cookie.maxAge at that moment. Setting it
        // after logIn left the store row at the 1-day default, so "remember me"
        // sessions died after a day even though the browser cookie lasted 30 days.
        if (req.body.rememberMe && req.session) {
          req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE;
        }
        req.logIn(user, async (loginErr) => {
          if (loginErr) return next(loginErr);
          (req.session as any).ipAddress = req.headers["x-forwarded-for"]
            ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
            : req.socket.remoteAddress || "unknown";
          (req.session as any).userAgent = req.headers["user-agent"] || "unknown";
          (req.session as any).loginAt = new Date().toISOString();
          const isIncognito = !!(req.session as any)?.incognito;
          if (!isIncognito) {
            try {
              const ip = req.headers["x-forwarded-for"]
                ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
                : req.socket.remoteAddress || "unknown";
              await storage.createLoginLog({
                userId: user.id,
                email: user.email,
                name: user.name,
                loginAt: new Date().toISOString(),
                ipAddress: ip,
              });
            } catch (_) {}
          }
          const { password, ...safe } = user;
          const effectivePermsStr = (req.session as any)?.effectivePermissions ?? safe.permissions;
          const perms = parsePermissions(effectivePermsStr, !!safe.isAdmin, (safe as any).isTeamAdmin === 1);
          let teamEnabledAreas: string[] | null = null;
          const effectiveTeamId = safe.activeTeamId ?? safe.teamId;
          if (effectiveTeamId && safe.isAdmin !== 1) {
            try {
              const team = await storage.getTeam(effectiveTeamId);
              if (team?.enabledAreas) {
                teamEnabledAreas = JSON.parse(team.enabledAreas);
              }
            } catch {}
          }
          const isStealth = !!(req.session as any)?.stealth;
          return res.json({ ...safe, parsedPermissions: perms, incognito: isIncognito, stealth: isStealth, isBlindTester: !!safe.isBlindTester, garminWatch: !!safe.garminWatch, teamEnabledAreas });
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ ok: true });
      });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { password, ...safe } = req.user;
    const effectivePermsStr = (req.session as any)?.effectivePermissions ?? safe.permissions;
    const perms = parsePermissions(effectivePermsStr, !!safe.isAdmin, safe.isTeamAdmin === 1);
    const incognito = !!(req.session as any)?.incognito;
    const stealth = !!(req.session as any)?.stealth;
    let teamEnabledAreas: string[] | null = null;
    const effectiveTeamId = safe.activeTeamId ?? safe.teamId;
    if (effectiveTeamId && safe.isAdmin !== 1) {
      try {
        const team = await storage.getTeam(effectiveTeamId);
        if (team?.enabledAreas) {
          teamEnabledAreas = JSON.parse(team.enabledAreas);
        }
      } catch {}
    }
    // Fetch extra user fields not stored in session
    let dateFormat: string = 'european';
    try {
      const dfRow = await pool.query(`SELECT date_format FROM users WHERE id = $1`, [safe.id]);
      if (dfRow.rows[0]?.date_format) dateFormat = dfRow.rows[0].date_format;
    } catch {}
    return res.json({ ...safe, teamId: safe.teamId, isTeamAdmin: safe.isTeamAdmin, activeTeamId: safe.activeTeamId, parsedPermissions: perms, incognito, stealth, isBlindTester: !!safe.isBlindTester, garminWatch: !!safe.garminWatch, teamEnabledAreas, dateFormat, isAthleteAccess: !!(safe as any).isAthleteAccess, linkedAthleteId: (safe as any).linkedAthleteId ?? null });
  });

  app.post("/api/auth/incognito", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.user.isAdmin !== 1) {
      return res.status(403).json({ message: "Super Admin only" });
    }
    const { enabled } = req.body;
    (req.session as any).incognito = !!enabled;
    req.session.save(() => {
      res.json({ incognito: !!enabled });
    });
  });

  app.post("/api/auth/stealth", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.user.isAdmin !== 1) {
      return res.status(403).json({ message: "Super Admin only" });
    }
    const { enabled } = req.body;
    if (enabled) {
      const activeTeamId = (req.user as any).activeTeamId || req.user.teamId;
      if (activeTeamId === req.user.teamId) {
        return res.status(400).json({ message: "Stealth mode is only available when viewing another team" });
      }
    }
    (req.session as any).stealth = !!enabled;
    if (enabled) {
      (req.session as any).incognitoBeforeStealth = !!(req.session as any).incognito;
      (req.session as any).incognito = true;
    } else {
      const prev = (req.session as any).incognitoBeforeStealth;
      (req.session as any).incognito = !!prev;
      delete (req.session as any).incognitoBeforeStealth;
    }
    req.session.save(() => {
      res.json({ stealth: !!enabled, incognito: !!(req.session as any).incognito });
    });
  });

  app.get("/api/auth/my-sessions", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    const { pool: pg } = await import("./db");
    const currentSid = req.sessionID;
    const result = await (pg as any).query(
      `SELECT sid, sess, expire FROM user_sessions
       WHERE expire > NOW()
         AND sess::json->'passport'->>'user' = $1
       ORDER BY expire DESC`,
      [String(req.user.id)]
    );
    const sessions = result.rows.map((row: any) => ({
      sid: row.sid,
      isCurrent: row.sid === currentSid,
      ipAddress: row.sess?.ipAddress || "unknown",
      userAgent: row.sess?.userAgent || "unknown",
      loginAt: row.sess?.loginAt || null,
      expiresAt: row.expire,
    }));
    res.json(sessions);
  });

  app.delete("/api/auth/sessions/:sid", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    const { pool: pg } = await import("./db");
    const sid = req.params.sid;
    // Verify session belongs to this user before deleting
    const check = await (pg as any).query(
      `SELECT sid FROM user_sessions WHERE sid = $1 AND sess::json->'passport'->>'user' = $2`,
      [sid, String(req.user.id)]
    );
    if (!check.rows.length) return res.status(404).json({ message: "Session not found" });
    await (pg as any).query(`DELETE FROM user_sessions WHERE sid = $1`, [sid]);
    res.json({ ok: true });
  });

  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=google" }),
    (_req, res) => res.redirect("/dashboard"),
  );
}
