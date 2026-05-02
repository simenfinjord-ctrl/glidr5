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

/**
 * Returns a Google Sheets client using whichever auth method is available.
 * Throws if neither is configured.
 */
export async function getUncachableGoogleSheetClient() {
  // Prefer service account (works on Render, any host)
  const saClient = getServiceAccountClient();
  if (saClient) return saClient;

  // Fall back to Replit connector
  return getReplitClient();
}

/**
 * Returns true if Google Sheets backup is configured and ready to use.
 */
export function isGoogleSheetsAvailable(): boolean {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return true;
  if (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL) return true;
  return false;
}
