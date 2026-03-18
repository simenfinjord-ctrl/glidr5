import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { type Express, type Request } from "express";
import { storage } from "./storage";
import { pool } from "./db";
import { type User, type UserPermissions, DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS } from "@shared/schema";

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
      password: string;
    }
  }
}

export function parsePermissions(permissionsStr: string | null | undefined, isAdmin: boolean, isTeamAdmin?: boolean): UserPermissions {
  if (isAdmin || isTeamAdmin) return { ...ADMIN_PERMISSIONS };
  try {
    const parsed = JSON.parse(permissionsStr || "{}");
    return { ...DEFAULT_PERMISSIONS, ...parsed };
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

export function setupAuth(app: Express) {
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
      secure: true,
      sameSite: "none" as const,
      partitioned: true,
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
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "No user found for that email." });
          }
          if (user.password !== password) {
            return done(null, false, { message: "Invalid password." });
          }
          if (user.isActive === 0) {
            return done(null, false, { message: "Account is deactivated. Contact your administrator." });
          }
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

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message: string }) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      req.logIn(user, async (err) => {
        if (err) return next(err);
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
        const perms = parsePermissions(safe.permissions, !!safe.isAdmin, (safe as any).isTeamAdmin === 1);
        return res.json({ ...safe, parsedPermissions: perms, incognito: isIncognito, isBlindTester: !!safe.isBlindTester });
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

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { password, ...safe } = req.user;
    const perms = parsePermissions(safe.permissions, !!safe.isAdmin, safe.isTeamAdmin === 1);
    const incognito = !!(req.session as any)?.incognito;
    return res.json({ ...safe, teamId: safe.teamId, isTeamAdmin: safe.isTeamAdmin, activeTeamId: safe.activeTeamId, parsedPermissions: perms, incognito, isBlindTester: !!safe.isBlindTester });
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
}
