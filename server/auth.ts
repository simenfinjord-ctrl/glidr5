import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
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
  if (!hashed.startsWith("$2")) {
    return plain === hashed;
  }
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

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "glidr-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
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
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message: string }) => {
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
        if (req.body.rememberMe) (req.session as any).pending2faRememberMe = true;
        await new Promise<void>((resolve) => req.session.save(() => resolve()));
        return res.status(200).json({ requires2fa: true });
      }

      // No 2FA — regenerate session to prevent fixation, then log in
      req.session.regenerate((regenErr) => {
        if (regenErr) return next(regenErr);
        req.logIn(user, async (loginErr) => {
          if (loginErr) return next(loginErr);
          if (req.body.rememberMe && req.session) {
            req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE;
          }
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
    return res.json({ ...safe, teamId: safe.teamId, isTeamAdmin: safe.isTeamAdmin, activeTeamId: safe.activeTeamId, parsedPermissions: perms, incognito, stealth, isBlindTester: !!safe.isBlindTester, garminWatch: !!safe.garminWatch, teamEnabledAreas });
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
}
