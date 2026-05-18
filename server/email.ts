// Uses Resend REST API via native fetch — no extra package needed.

function getApiKey(): string | null {
  return process.env.RESEND_API_KEY || process.env.SMTP_PASS || null;
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

const welcomeCopy: Record<string, {
  subject: string;
  greeting: (n: string) => string;
  intro: string;
  button: string;
  howTitle: string;
  howItems: string[];
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
    subTitle: "Abonnement og endringer",
    subItems: [
      "Du administrerer abonnementet ditt under <strong>Min konto → Abonnement</strong>.",
      "Du kan når som helst oppgradere, nedgradere eller si opp abonnementet.",
      "Endringer trer i kraft ved neste faktureringsperiode.",
      "Har du spørsmål om fakturering eller abonnement? Send oss en e-post på <a href='mailto:simen.finjord@hotmail.com' style='color:#111;'>simen.finjord@hotmail.com</a>.",
    ],
    subNote: "Gratis prøveperiode gjelder i 14 dager — ingen kredittkort nødvendig for å komme i gang.",
    footer: "Har du spørsmål? Svar på denne e-posten eller skriv til simen.finjord@hotmail.com, så hjelper vi deg.",
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
    subTitle: "Subscription & changes",
    subItems: [
      "Manage your subscription under <strong>My Account → Subscription</strong>.",
      "You can upgrade, downgrade or cancel your subscription at any time.",
      "Changes take effect at the next billing period.",
      "Questions about billing or your subscription? Email us at <a href='mailto:simen.finjord@hotmail.com' style='color:#111;'>simen.finjord@hotmail.com</a>.",
    ],
    subNote: "Free trial lasts 14 days — no credit card required to get started.",
    footer: "Got questions? Reply to this email or write to simen.finjord@hotmail.com and we'll help you out.",
  },
};

export async function sendWelcomeEmail(
  to: string,
  name: string,
  lang: string = "no",
): Promise<void> {
  const c = welcomeCopy[lang] ?? welcomeCopy.no;
  const appUrl = process.env.APP_URL || "https://glidr.no";

  const textLines = [
    c.greeting(name), "",
    c.intro, "",
    `--- ${c.howTitle} ---`, "",
    ...c.howItems.map(i => i.replace(/<[^>]+>/g, "")), "",
    `--- ${c.subTitle} ---`, "",
    ...c.subItems.map(i => i.replace(/<[^>]+>/g, "")), "",
    c.subNote, "",
    appUrl, "",
    c.footer, "",
    "— The Glidr team",
  ];

  const listItem = (html: string) =>
    `<li style="margin-bottom:10px;line-height:1.6;color:#444;">${html}</li>`;

  await sendEmail({
    to,
    subject: c.subject,
    text: textLines.join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111;">

        <div style="font-size:22px;font-weight:700;margin-bottom:8px;">${c.subject}</div>

        <p style="color:#444;line-height:1.6;margin-bottom:28px;">
          ${c.greeting(name)}<br><br>${c.intro}
        </p>

        <a href="${appUrl}"
          style="display:inline-block;background:#111;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:36px;">
          ${c.button}
        </a>

        <!-- How it works -->
        <div style="background:#f8f8f8;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <div style="font-size:15px;font-weight:700;margin-bottom:14px;">${c.howTitle}</div>
          <ul style="margin:0;padding-left:4px;list-style:none;">
            ${c.howItems.map(listItem).join("")}
          </ul>
        </div>

        <!-- Subscription -->
        <div style="background:#f0f7ff;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <div style="font-size:15px;font-weight:700;margin-bottom:14px;">${c.subTitle}</div>
          <ul style="margin:0;padding-left:4px;list-style:none;">
            ${c.subItems.map(listItem).join("")}
          </ul>
          <p style="margin:14px 0 0;font-size:12px;color:#666;background:#fff;border-radius:8px;padding:10px 14px;">
            ${c.subNote}
          </p>
        </div>

        <p style="color:#888;font-size:13px;line-height:1.6;">${c.footer}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
        <p style="color:#bbb;font-size:12px;">— The Glidr team</p>
      </div>
    `,
  });
}
