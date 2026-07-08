// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Uses Resend REST API via native fetch — no extra package needed.

function getApiKey(): string | null {
  return process.env.RESEND_API_KEY || process.env.SMTP_PASS || null;
}

// ── Branded HTML wrapper ───────────────────────────────────────────────────────
// Every email uses this shell so they all look identical and on-brand.

function emailHtml(content: string, footerLine?: string): string {
  const footer = footerLine ?? "Glidr · hei@glidr.no · glidr.no";
  return `<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

        <!-- Header -->
        <tr>
          <td style="background:#059669;border-radius:12px 12px 0 0;padding:22px 32px;">
            <span style="color:#fff;font-family:system-ui,-apple-system,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Glidr<span style="color:#a7f3d0;">.</span></span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px;font-family:system-ui,-apple-system,sans-serif;color:#111827;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 0 8px;text-align:center;font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#9ca3af;">
            ${footer}<br>
            <span style="color:#d1d5db;">© 2026 Glidr</span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function emailBtn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#059669;color:#ffffff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;font-family:system-ui,-apple-system,sans-serif;">${label}</a>`;
}

function emailHr(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">`;
}

function emailMeta(html: string): string {
  return `<p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">${html}</p>`;
}

const fromAddress = () =>
  process.env.SMTP_FROM || "noreply@glidr.no";

async function sendEmail(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[email] RESEND_API_KEY mangler i produksjon — e-post kan ikke sendes");
    }
    console.warn("[email] No API key — set RESEND_API_KEY or SMTP_PASS.");
    console.log(`[email] Would have sent "${payload.subject}" to ${payload.to}`);
    return;
  }

  const body = JSON.stringify({
    from: fromAddress(),
    to: [payload.to],
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[email] Resend API error ${res.status}: ${err}`);
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }

  console.log(`[email] Sent "${payload.subject}" to ${payload.to}`);
}

// ── Password reset ─────────────────────────────────────────────────────────────

const resetCopy: Record<string, {
  subject: string;
  greeting: (n: string) => string;
  body: string;
  button: string;
  expire: string;
  ignore: string;
}> = {
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
  await sendEmail({
    to,
    subject: c.subject,
    text: [
      c.greeting(name), "",
      c.body, "",
      resetLink, "",
      c.expire.replace(/<[^>]+>/g, ""),
      c.ignore, "",
      "— The Glidr team",
    ].join("\n"),
    html: emailHtml(`
      <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 6px;">${c.greeting(name)}</p>
      <p style="color:#4b5563;line-height:1.7;margin:0 0 28px;">${c.body}</p>
      ${emailBtn(resetLink, c.button)}
      ${emailHr()}
      ${emailMeta(`${c.expire}<br>${c.ignore}`)}
    `),
  });
}

// ── Invitation email ───────────────────────────────────────────────────────────

const inviteCopy: Record<string, {
  subject: (teamName: string) => string;
  greeting: string;
  body: (teamName: string, invitedByName: string) => string;
  button: string;
  expire: string;
  footer: string;
}> = {
  no: {
    subject: (teamName) => `Du er invitert til ${teamName} på Glidr`,
    greeting: "Hei!",
    body: (teamName, invitedByName) => `Du har blitt invitert til å bli med i teamet <strong>${teamName}</strong> på Glidr av ${invitedByName}. Klikk knappen nedenfor for å godta invitasjonen.`,
    button: "Godta invitasjon",
    expire: "Invitasjonen utløper om <strong>48 timer</strong>.",
    footer: "Har du spørsmål? Kontakt hei@glidr.no eller ring +47 975 40 178",
  },
  en: {
    subject: (teamName) => `You've been invited to ${teamName} on Glidr`,
    greeting: "Hi!",
    body: (teamName, invitedByName) => `You have been invited to join the team <strong>${teamName}</strong> on Glidr by ${invitedByName}. Click the button below to accept.`,
    button: "Accept invitation",
    expire: "This invitation expires in <strong>48 hours</strong>.",
    footer: "Got questions? Contact hei@glidr.no or call +47 975 40 178",
  },
};

export async function sendInvitationEmail(
  to: string,
  teamName: string,
  invitedByName: string,
  inviteLink: string,
  lang: string = "no",
): Promise<void> {
  const c = inviteCopy[lang] ?? inviteCopy.no;
  const subject = c.subject(teamName);
  const bodyHtml = c.body(teamName, invitedByName);
  const bodyText = bodyHtml.replace(/<[^>]+>/g, "");

  await sendEmail({
    to,
    subject,
    text: [
      c.greeting, "",
      bodyText, "",
      inviteLink, "",
      c.expire.replace(/<[^>]+>/g, ""), "",
      c.footer, "",
      "— The Glidr team",
    ].join("\n"),
    html: emailHtml(`
      <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 6px;">${c.greeting}</p>
      <p style="color:#4b5563;line-height:1.7;margin:0 0 28px;">${bodyHtml}</p>
      ${emailBtn(inviteLink, c.button)}
      ${emailHr()}
      ${emailMeta(`${c.expire}<br>${c.footer}`)}
    `),
  });
}

// ── Welcome email ──────────────────────────────────────────────────────────────

const welcomeCopy: Record<string, {
  subject: string;
  greeting: (n: string) => string;
  intro: string;
  button: string;
  howTitle: string;
  howItems: string[];
  pwaTitle: string;
  pwaIntro: string;
  pwaIos: string[];
  pwaAndroid: string[];
  tipsTitle: string;
  tipsItems: string[];
  subTitle: string;
  subItems: string[];
  subNote: string;
  footer: string;
}> = {
  no: {
    subject: "Velkommen til Glidr!",
    greeting: (n) => `Hei ${n}!`,
    intro: "Kontoen din er nå klar. Glidr er et digitalt verktøy for testregistrering av ski og skøyter — laget for serviceteam som vil ha full oversikt over utstyr, resultater og testforhold.",
    button: "Åpne Glidr",
    howTitle: "Slik fungerer Glidr",
    howItems: [
      "📋 <strong>Testregistrering</strong> — Registrer ski, glid og struktur-tester med alle relevante parametere (snøtemperatur, luftfuktighet, snøtype, sporharhet og mye mer).",
      "📊 <strong>Resultater og analyse</strong> — Sammenlign produkter og tester over tid. Se hva som fungerte best under ulike forhold.",
      "💡 <strong>AI-anbefalinger</strong> — Få forslag til produkter basert på dine egne testdata og de aktuelle forholdene.",
      "🎿 <strong>Ski-oversikt</strong> — Hold styr på alt utstyr i teamet ditt med skiregisteret.",
      "👥 <strong>Team-samarbeid</strong> — Inviter kollegaer og del testdata på tvers av teamet.",
    ],
    pwaTitle: "📱 Installer Glidr på telefonen din",
    pwaIntro: "Glidr kan installeres direkte på telefonen din — uten App Store. Du får en ikon på hjemskjermen og full skjerm, akkurat som en vanlig app.",
    pwaIos: [
      "<strong>iPhone / iPad (Safari):</strong>",
      "1. Åpne glidr.no i Safari",
      "2. Trykk på Del-ikonet nederst (firkant med pil opp)",
      "3. Velg «Legg til på hjemskjerm»",
      "4. Trykk «Legg til» — ferdig!",
    ],
    pwaAndroid: [
      "<strong>Android (Chrome):</strong>",
      "1. Åpne glidr.no i Chrome",
      "2. Trykk på menyikonet (⋮) øverst til høyre",
      "3. Velg «Legg til på startskjermen»",
      "4. Bekreft — ferdig!",
    ],
    tipsTitle: "💡 Tips for å komme i gang",
    tipsItems: [
      "🌐 <strong>Velg språk</strong> — Bytt mellom norsk og engelsk under <strong>Min konto</strong>.",
      "🔐 <strong>To-faktor-autentisering</strong> — Aktiver 2FA under Min konto for ekstra sikkerhet (anbefales for administratorer).",
      "👥 <strong>Inviter teammedlemmer</strong> — Send invitasjoner direkte fra <strong>Min konto → Inviter teammedlemmer</strong>.",
      "🌙 <strong>Mørk modus</strong> — Bytt tema med ikonet øverst til høyre i appen.",
      "📴 <strong>Offline</strong> — Appen fungerer uten internett — data synkroniseres automatisk når du er tilkoblet igjen.",
    ],
    subTitle: "Abonnement og endringer",
    subItems: [
      "Du administrerer abonnementet ditt under <strong>Min konto → Abonnement</strong>.",
      "Du kan når som helst oppgradere, nedgradere eller si opp abonnementet.",
      "Endringer trer i kraft ved neste faktureringsperiode.",
      "Har du spørsmål om fakturering eller abonnement? Send oss en e-post på <a href='mailto:hei@glidr.no' style='color:#111;'>hei@glidr.no</a> eller ring <a href='tel:+4797540178' style='color:#111;'>+47 975 40 178</a>.",
    ],
    subNote: "Gratis prøveperiode gjelder i 14 dager — ingen kredittkort nødvendig for å komme i gang.",
    footer: "Har du spørsmål? Svar på denne e-posten, skriv til hei@glidr.no eller ring +47 975 40 178.",
  },
  en: {
    subject: "Welcome to Glidr!",
    greeting: (n) => `Hi ${n}!`,
    intro: "Your account is ready. Glidr is a digital tool for ski and skate test logging — built for service teams who want full control over equipment, results, and testing conditions.",
    button: "Open Glidr",
    howTitle: "How Glidr works",
    howItems: [
      "📋 <strong>Test logging</strong> — Record ski, glide and structure tests with all relevant parameters (snow temperature, humidity, snow type, track hardness and more).",
      "📊 <strong>Results & analysis</strong> — Compare products and tests over time. See what worked best under different conditions.",
      "💡 <strong>AI recommendations</strong> — Get product suggestions based on your own test data and current conditions.",
      "🎿 <strong>Equipment overview</strong> — Keep track of all equipment in your team with the ski register.",
      "👥 <strong>Team collaboration</strong> — Invite colleagues and share test data across the team.",
    ],
    pwaTitle: "📱 Install Glidr on your phone",
    pwaIntro: "Glidr can be installed directly on your phone — no App Store needed. You'll get a home screen icon and full-screen experience, just like a native app.",
    pwaIos: [
      "<strong>iPhone / iPad (Safari):</strong>",
      "1. Open glidr.no in Safari",
      "2. Tap the Share icon at the bottom (square with arrow)",
      "3. Select «Add to Home Screen»",
      "4. Tap «Add» — done!",
    ],
    pwaAndroid: [
      "<strong>Android (Chrome):</strong>",
      "1. Open glidr.no in Chrome",
      "2. Tap the menu icon (⋮) top right",
      "3. Select «Add to Home screen»",
      "4. Confirm — done!",
    ],
    tipsTitle: "💡 Tips to get started",
    tipsItems: [
      "🌐 <strong>Choose language</strong> — Switch between Norwegian and English under <strong>My Account</strong>.",
      "🔐 <strong>Two-factor authentication</strong> — Enable 2FA under My Account for extra security (recommended for admins).",
      "👥 <strong>Invite team members</strong> — Send invitations directly from <strong>My Account → Invite team members</strong>.",
      "🌙 <strong>Dark mode</strong> — Toggle theme with the icon in the top right of the app.",
      "📴 <strong>Offline</strong> — The app works without internet — data syncs automatically when you reconnect.",
    ],
    subTitle: "Subscription & changes",
    subItems: [
      "Manage your subscription under <strong>My Account → Subscription</strong>.",
      "You can upgrade, downgrade or cancel your subscription at any time.",
      "Changes take effect at the next billing period.",
      "Questions about billing or your subscription? Email us at <a href='mailto:hei@glidr.no' style='color:#111;'>hei@glidr.no</a> or call <a href='tel:+4797540178' style='color:#111;'>+47 975 40 178</a>.",
    ],
    subNote: "Free trial lasts 14 days — no credit card required to get started.",
    footer: "Got questions? Reply to this email, write to hei@glidr.no or call +47 975 40 178.",
  },
};

// Billing/subscription copy only goes out when the SA has turned commercialization
// on. While Glidr is given away for free we never mention pricing or trials.
async function isCommercializationOn(): Promise<boolean> {
  try {
    const { pool } = await import("./db");
    const r = await (pool as any).query(`SELECT value FROM app_settings WHERE key = 'commercialization_enabled'`);
    return r.rows[0]?.value === "true";
  } catch { return false; }
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
  lang: string = "no",
): Promise<void> {
  const c = welcomeCopy[lang] ?? welcomeCopy.no;
  const appUrl = process.env.APP_URL || "https://glidr.no";
  const showBilling = await isCommercializationOn();

  const strip = (s: string) => s.replace(/<[^>]+>/g, "");

  const textLines = [
    c.greeting(name), "",
    c.intro, "",
    `--- ${c.howTitle} ---`, "",
    ...c.howItems.map(strip), "",
    `--- ${c.pwaTitle} ---`, "",
    strip(c.pwaIntro), "",
    ...c.pwaIos.map(strip), "",
    ...c.pwaAndroid.map(strip), "",
    `--- ${c.tipsTitle} ---`, "",
    ...c.tipsItems.map(strip), "",
    ...(showBilling ? [`--- ${c.subTitle} ---`, "", ...c.subItems.map(strip), "", c.subNote, ""] : []),
    appUrl, "",
    c.footer, "",
    "— The Glidr team",
  ];

  const listItem = (html: string) =>
    `<li style="margin-bottom:10px;line-height:1.6;color:#444;">${html}</li>`;

  const stepItem = (html: string) =>
    `<li style="margin-bottom:6px;line-height:1.6;color:#444;">${html}</li>`;

  await sendEmail({
    to,
    subject: c.subject,
    text: textLines.join("\n"),
    html: emailHtml(`
      <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 6px;">${c.greeting(name)}</p>
      <p style="color:#4b5563;line-height:1.7;margin:0 0 24px;">${c.intro}</p>

      ${emailBtn(appUrl, c.button)}

      <!-- How it works -->
      <div style="background:#f9fafb;border-radius:10px;padding:18px 20px;margin:28px 0 20px;">
        <p style="font-size:13px;font-weight:700;color:#111827;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">${c.howTitle}</p>
        <ul style="margin:0;padding-left:0;list-style:none;">
          ${c.howItems.map(listItem).join("")}
        </ul>
      </div>

      <!-- PWA install -->
      <div style="background:#ecfdf5;border-radius:10px;padding:18px 20px;margin-bottom:20px;">
        <p style="font-size:13px;font-weight:700;color:#065f46;margin:0 0 8px;">${c.pwaTitle}</p>
        <p style="font-size:13px;color:#4b5563;line-height:1.6;margin:0 0 14px;">${c.pwaIntro}</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:50%;padding-right:8px;vertical-align:top;">
              <div style="background:#fff;border-radius:8px;padding:12px;">
                <ul style="margin:0;padding-left:0;list-style:none;">
                  ${c.pwaIos.map(stepItem).join("")}
                </ul>
              </div>
            </td>
            <td style="width:50%;padding-left:8px;vertical-align:top;">
              <div style="background:#fff;border-radius:8px;padding:12px;">
                <ul style="margin:0;padding-left:0;list-style:none;">
                  ${c.pwaAndroid.map(stepItem).join("")}
                </ul>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Tips -->
      <div style="background:#fffbeb;border-radius:10px;padding:18px 20px;margin-bottom:20px;">
        <p style="font-size:13px;font-weight:700;color:#78350f;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">${c.tipsTitle}</p>
        <ul style="margin:0;padding-left:0;list-style:none;">
          ${c.tipsItems.map(listItem).join("")}
        </ul>
      </div>

      <!-- Subscription (only when commercialization is enabled) -->
      ${showBilling ? `
      <div style="background:#eff6ff;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
        <p style="font-size:13px;font-weight:700;color:#1e40af;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">${c.subTitle}</p>
        <ul style="margin:0;padding-left:0;list-style:none;">
          ${c.subItems.map(listItem).join("")}
        </ul>
        <p style="margin:12px 0 0;font-size:12px;color:#6b7280;background:#fff;border-radius:8px;padding:10px 12px;">${c.subNote}</p>
      </div>` : ""}

      ${emailHr()}
      ${emailMeta(c.footer)}
    `, "Glidr · hei@glidr.no · glidr.no"),
  });
}

// ── Interest / registration notification (sent to owner) ──────────────────────

// #30: notify the owner (hei@glidr.no) about a problem report / error so the
// SA doesn't have to log in daily to discover follow-ups.
export async function sendProblemReportNotification(report: {
  fromName: string; fromEmail?: string | null; teamName?: string | null; subject: string; body: string;
}): Promise<void> {
  const ownerEmail = process.env.OWNER_EMAIL || "hei@glidr.no";
  const rows = [
    ["Fra", report.fromName],
    ...(report.fromEmail ? [["E-post", report.fromEmail]] : []),
    ...(report.teamName ? [["Lag", report.teamName]] : []),
    ["Tema", report.subject],
  ] as [string, string][];
  const tableRows = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 12px;font-size:13px;color:#6b7280;white-space:nowrap;">${k}</td><td style="padding:6px 12px;font-size:13px;font-weight:600;color:#111827;">${v}</td></tr>`
  ).join("");
  await sendEmail({
    to: ownerEmail,
    subject: `Glidr-feilmelding: ${report.subject}`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n${report.body}`,
    html: emailHtml(`
      <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 20px;">Ny feilmelding / rapport ⚠️</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:16px;">${tableRows}</table>
      <p style="font-size:13px;color:#374151;white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:24px;">${report.body.replace(/</g, "&lt;")}</p>
      <a href="https://glidr.no/inbox" style="display:inline-block;background:#059669;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Åpne innboks</a>
    `),
  });
}

export async function sendInterestNotification(reg: {
  contactName: string;
  email: string;
  phone?: string | null;
  teamName: string;
  planName?: string | null;
  userCount?: number | null;
  billingPeriod?: string | null;
  notes?: string | null;
}): Promise<void> {
  const ownerEmail = process.env.OWNER_EMAIL || "hei@glidr.no";
  const plan = reg.planName ?? "team";
  const subject = `Ny registrering: ${reg.teamName} (${plan})`;

  const rows = [
    ["Kontaktperson", reg.contactName],
    ["E-post", reg.email],
    ...(reg.phone ? [["Telefon", reg.phone]] : []),
    ["Lag/org", reg.teamName],
    ["Plan", plan],
    ...(reg.userCount != null ? [["Antall brukere", String(reg.userCount)]] : []),
    ...(reg.billingPeriod ? [["Faktureringsperiode", reg.billingPeriod]] : []),
    ...(reg.notes ? [["Merknad", reg.notes]] : []),
  ] as [string, string][];

  const tableRows = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 12px;font-size:13px;color:#6b7280;white-space:nowrap;">${k}</td><td style="padding:6px 12px;font-size:13px;font-weight:600;color:#111827;">${v}</td></tr>`
  ).join("");

  await sendEmail({
    to: ownerEmail,
    subject,
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    html: emailHtml(`
      <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 20px;">
        Ny interesseregistrering mottatt 🎉
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:24px;">
        ${tableRows}
      </table>
      <a href="https://glidr.no/admin" style="display:inline-block;background:#059669;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Åpne Admin → Registreringer
      </a>
    `),
  });
}

