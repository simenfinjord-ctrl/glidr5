import nodemailer from "nodemailer";

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.warn("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in env.");
    return null;
  }
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

const from = () =>
  `"Glidr" <${process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@glidr.no"}>`;

// ── Password reset ─────────────────────────────────────────────────────────────

const resetCopy: Record<string, { subject: string; greeting: (n: string) => string; body: string; button: string; expire: string; ignore: string }> = {
  no: {
    subject: "Tilbakestill Glidr-passordet ditt",
    greeting: (n) => `Hei ${n},`,
    body: "Du har bedt om å tilbakestille passordet for din Glidr-konto. Klikk på knappen nedenfor for å sette et nytt passord.",
    button: "Tilbakestill passord",
    expire: "Lenken utløper om <strong>1 time</strong>.",
    ignore: "Hvis du ikke ba om dette, kan du trygt ignorere denne e-posten — passordet ditt vil ikke endres.",
  },
  en: {
    subject: "Reset your Glidr password",
    greeting: (n) => `Hi ${n},`,
    body: "You requested a password reset for your Glidr account. Click the button below to set a new password.",
    button: "Reset password",
    expire: "This link expires in <strong>1 hour</strong>.",
    ignore: "If you didn't request this, you can safely ignore this email — your password will not change.",
  },
};

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetLink: string,
  lang: string = "no",
): Promise<void> {
  const c = resetCopy[lang] ?? resetCopy.no;
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[email] Password reset for ${to}: ${resetLink}`);
    return;
  }
  const textLines = [
    c.greeting(name),
    "",
    c.body,
    "",
    resetLink,
    "",
    c.expire.replace(/<[^>]+>/g, ""),
    c.ignore,
    "",
    "— The Glidr team",
  ];
  await transporter.sendMail({
    from: from(),
    to,
    subject: c.subject,
    text: textLines.join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#111;">
        <div style="font-size:22px;font-weight:700;margin-bottom:24px;">${c.subject}</div>
        <p style="color:#444;line-height:1.6;margin-bottom:28px;">
          ${c.greeting(name)}<br><br>${c.body}
        </p>
        <a href="${resetLink}"
          style="display:inline-block;background:#111;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:28px;">
          ${c.button}
        </a>
        <p style="color:#888;font-size:13px;line-height:1.6;">
          ${c.expire}<br>${c.ignore}
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
        <p style="color:#bbb;font-size:12px;">— The Glidr team</p>
      </div>
    `,
  });
}

// ── Welcome email ──────────────────────────────────────────────────────────────

const welcomeCopy: Record<string, { subject: string; greeting: (n: string) => string; body: string; button: string; footer: string }> = {
  no: {
    subject: "Velkommen til Glidr!",
    greeting: (n) => `Hei ${n}!`,
    body: "Kontoen din er nå klar. Logg inn på Glidr for å starte testregistrering.",
    button: "Åpne Glidr",
    footer: "Har du spørsmål? Svar på denne e-posten, så hjelper vi deg.",
  },
  en: {
    subject: "Welcome to Glidr!",
    greeting: (n) => `Hi ${n}!`,
    body: "Your account is ready. Log in to Glidr to start recording tests.",
    button: "Open Glidr",
    footer: "Got questions? Reply to this email and we'll help you out.",
  },
};

export async function sendWelcomeEmail(
  to: string,
  name: string,
  lang: string = "no",
): Promise<void> {
  const c = welcomeCopy[lang] ?? welcomeCopy.no;
  const appUrl = process.env.APP_URL || "https://glidr.no";
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[email] Welcome email for ${to} (${lang}) — SMTP not configured`);
    return;
  }
  await transporter.sendMail({
    from: from(),
    to,
    subject: c.subject,
    text: [c.greeting(name), "", c.body, "", appUrl, "", c.footer, "", "— The Glidr team"].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#111;">
        <div style="font-size:22px;font-weight:700;margin-bottom:24px;">${c.subject}</div>
        <p style="color:#444;line-height:1.6;margin-bottom:28px;">
          ${c.greeting(name)}<br><br>${c.body}
        </p>
        <a href="${appUrl}"
          style="display:inline-block;background:#111;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:28px;">
          ${c.button}
        </a>
        <p style="color:#888;font-size:13px;line-height:1.6;">${c.footer}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
        <p style="color:#bbb;font-size:12px;">— The Glidr team</p>
      </div>
    `,
  });
}
