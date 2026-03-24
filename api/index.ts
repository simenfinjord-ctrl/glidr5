import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { setupAuth } from "../server/auth";
import { createServer } from "http";
import { seedDatabase } from "../server/seed";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

setupAuth(app);

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await seedDatabase();
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error("Internal Server Error:", err);
      if (res.headersSent) return next(err);
      return res.status(status).json({ message });
    });

    initialized = true;
  }
}

const handler = async (req: any, res: any) => {
  await ensureInitialized();
  app(req, res);
};

export default handler;
