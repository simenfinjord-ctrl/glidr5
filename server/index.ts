// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import * as Sentry from "@sentry/node";
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? "development" });
}

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ── Process-level crash protection ─────────────────────────────────────────
// Hindrer at én ubehandlet feil krasjer hele Node-prosessen
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Ubehandlet promise-avvisning:", reason);
  // Logg til Sentry hvis konfigurert, men krasj IKKE
  if (process.env.SENTRY_DSN) {
    try { (Sentry as any).captureException(reason); } catch (_) {}
  }
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] Kritisk ubehandlet feil — avslutter prosessen:", err);
  if (process.env.SENTRY_DSN) {
    try { (Sentry as any).captureException(err); } catch (_) {}
  }
  // Avslutt prosessen — Render restarter automatisk.
  // Fortsette etter uncaughtException er farlig (udefinert tilstand).
  process.exit(1);
});

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabled — React app uses inline scripts
  crossOriginEmbedderPolicy: false,
}));

// ── General API rate limit: 200 req / 15 min per IP ────────────────────────
export const generalApiLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// ── Auth endpoints: 20 req / 15 min per IP ─────────────────────────────────
export const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

// ── Password reset: 5 req / hour per IP ────────────────────────────────────
export const resetLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Please try again in an hour." },
});

// ── Interest form: 10 req / hour per IP ────────────────────────────────────
export const interestLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many submissions. Please try again later." },
});

// ── 2FA login verify: 10 req / 15 min per IP ───────────────────────────────
export const twoFaLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification attempts. Please try again later." },
});

app.use(
  express.json({
    limit: "5mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Apply general rate limit to all /api routes
  app.use("/api", generalApiLimit);

  await setupAuth(app);
  try {
    await seedDatabase();
  } catch (err) {
    console.error("[seed] Database seeding failed (continuing startup):", err);
  }
  await registerRoutes(httpServer, app);

  Sentry.setupExpressErrorHandler(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Never leak internal error details in production
    const message = process.env.NODE_ENV === "production"
      ? (status < 500 ? err.message : "Internal Server Error")
      : (err.message || "Internal Server Error");

    if (status >= 500) {
      console.error("Internal Server Error:", err);
    }

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0" },
    async () => {
      log(`serving on port ${port}`);
      try {
        const { initAutoBackups } = await import("./backup");
        await initAutoBackups();
      } catch (err) {
        console.error("Failed to init auto-backups:", err);
      }

      if (process.env.NODE_ENV === "production") {
        const selfUrl = process.env.RENDER_EXTERNAL_URL || `https://glidr.onrender.com`;
        const keepAliveId = setInterval(async () => {
          try {
            await fetch(`${selfUrl}/api/health`, { signal: AbortSignal.timeout(8000) });
            log("Keep-alive ping sent", "keepalive");
          } catch (_) {}
        }, 5 * 60 * 1000);
        log(`Keep-alive enabled – pinging ${selfUrl}/api/health every 5 min`, "keepalive");

        // Rydd opp ved graceful shutdown
        process.once("SIGTERM", async () => {
          clearInterval(keepAliveId);
          try {
            const { stopAllAutoBackups } = await import("./backup");
            stopAllAutoBackups?.();
          } catch (_) {}
          log("SIGTERM mottatt — rydder opp og avslutter", "shutdown");
          httpServer.close(() => process.exit(0));
        });
      }
    },
  );
})();
