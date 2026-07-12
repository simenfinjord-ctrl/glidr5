// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Google Sheets integration
// Supports two auth modes:
//   1. Service Account (Render / any host): set GOOGLE_SERVICE_ACCOUNT_JSON env var
//   2. Replit OAuth connector (legacy): uses REPL_IDENTITY / WEB_REPL_RENEWAL
import { google } from 'googleapis';

// ─── Mode 1: Service Account ────────────────────────────────────────────────

function getServiceAccountClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const key = JSON.parse(raw);
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  } catch (err) {
    console.error('[GoogleSheets] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err);
    return null;
  }
}

// ─── Mode 2: Replit OAuth connector (legacy) ────────────────────────────────

let replitConnectionSettings: any;

function extractToken(cs: any): string | undefined {
  return cs?.settings?.access_token || cs?.settings?.oauth?.credentials?.access_token;
}

async function getReplitAccessToken() {
  if (
    replitConnectionSettings &&
    replitConnectionSettings.settings.expires_at &&
    new Date(replitConnectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    const cached = extractToken(replitConnectionSettings);
    if (cached) return cached;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  replitConnectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        Accept: 'application/json',
        'X-Replit-Token': xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  const accessToken = extractToken(replitConnectionSettings);
  if (!replitConnectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

async function getReplitClient() {
  const accessToken = await getReplitAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

// ─── Public API ─────────────────────────────────────────────────────────────

// --- Quota resilience -------------------------------------------------------
// The Sheets API caps "read requests per minute per user" (default 60/min).
// A backup run makes dozens of calls, so overlapping runs can trip the cap.
// Instead of failing the whole run, wait out the minute window and retry.
function isQuotaError(e: any): boolean {
  const status = e?.code ?? e?.response?.status;
  const msg = String(e?.message ?? e ?? "");
  return status === 429 || /quota exceeded/i.test(msg) || /rate limit/i.test(msg) || /RESOURCE_EXHAUSTED/i.test(msg);
}

async function callWithQuotaRetry<T>(fn: () => Promise<T>): Promise<T> {
  let delayMs = 35_000; // past the per-minute window on the first retry
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isQuotaError(e) || attempt >= 4) throw e;
      console.warn(`[Sheets] Quota hit — waiting ${Math.round(delayMs / 1000)}s, retry ${attempt}/3`);
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 2, 120_000);
    }
  }
}

/** Wrap the API methods we use so every call transparently retries on quota errors. */
function wrapQuotaRetry(sheets: any) {
  if (!sheets?.spreadsheets || (sheets as any).__quotaWrapped) return sheets;
  const wrap = (obj: any, key: string) => {
    if (typeof obj?.[key] !== "function") return;
    const orig = obj[key].bind(obj);
    obj[key] = (...args: any[]) => callWithQuotaRetry(() => orig(...args));
  };
  wrap(sheets.spreadsheets, "get");
  wrap(sheets.spreadsheets, "batchUpdate");
  wrap(sheets.spreadsheets, "create");
  if (sheets.spreadsheets.values) {
    for (const m of ["get", "update", "clear", "append", "batchGet", "batchUpdate"]) wrap(sheets.spreadsheets.values, m);
  }
  (sheets as any).__quotaWrapped = true;
  return sheets;
}

/**
 * Returns a Google Sheets client using whichever auth method is available.
 * Throws if neither is configured. Every client is wrapped so quota (429)
 * errors are retried with backoff instead of failing the whole backup run.
 */
export async function getUncachableGoogleSheetClient() {
  // Prefer service account (works on Render, any host)
  const saClient = getServiceAccountClient();
  if (saClient) return wrapQuotaRetry(saClient);

  // Fall back to Replit connector
  return wrapQuotaRetry(await getReplitClient());
}

/**
 * Returns true if Google Sheets backup is configured and ready to use.
 */
export function isGoogleSheetsAvailable(): boolean {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return true;
  if (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL) return true;
  return false;
}

/**
 * Returns a Google Drive v3 client using the service account.
 * Only available when GOOGLE_SERVICE_ACCOUNT_JSON is set.
 * Scopes cover: creating/updating files in shared folders (drive.file),
 * exporting Google Sheets as PDF (drive.readonly).
 */
export function getGoogleDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const key = JSON.parse(raw);
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
    });
    return { drive: google.drive({ version: 'v3', auth }), auth };
  } catch (err) {
    console.error('[GoogleDrive] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err);
    return null;
  }
}

/**
 * Returns the service account email, or null if not configured.
 */
export function getServiceAccountEmail(): string | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const key = JSON.parse(raw);
    return key.client_email ?? null;
  } catch { return null; }
}
