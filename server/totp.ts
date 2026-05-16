import { authenticator } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";

// otplib default window is ±1 step (30s tolerance each side)
authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret(20); // 20-byte = 160-bit secret
}

export function getTotpUri(email: string, issuer: string, secret: string): string {
  return authenticator.keyuri(email, issuer, secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.check(token, secret);
  } catch {
    return false;
  }
}

export async function generateQrDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, { margin: 2, width: 240 });
}

/** Generate 10 one-time backup codes (formatted XXXX-XXXX) */
export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: 10 }, () => {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
  const hashed = plain.map((code) =>
    crypto.createHash("sha256").update(normalizeBackupCode(code)).digest("hex"),
  );
  return { plain, hashed };
}

export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/-/g, "");
}

export function verifyBackupCode(input: string, hashes: string[]): { valid: boolean; remaining: string[] } {
  const normalized = normalizeBackupCode(input);
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  const idx = hashes.indexOf(hash);
  if (idx === -1) return { valid: false, remaining: hashes };
  const remaining = [...hashes];
  remaining.splice(idx, 1);
  return { valid: true, remaining };
}
