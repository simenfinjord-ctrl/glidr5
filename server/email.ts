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

const from = () => `"Glidr" <${process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@glidr.no"}>`;

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetLink: string,
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    // In dev/unconfigured: log the link so it's usable
    console.log(`[email] Password reset for ${to}: ${resetLink}`);
    return;
  }

  await transporter.sendMail({
    from: from(),
    to,
    subject: "Reset your Glidr password",
    text: [
      `Hi ${name},`,
      "",
      "You requested a password reset for your Glidr account.",
      "",
      `Reset your password here: ${resetLink}`,
      "",
      "This link expires in 1 hour. If you didn't request this, you can safely ignore this email.",
      "",
      "— The Glidr team",
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#111;">
        <div style="font-size:22px;font-weight:700;margin-bottom:24px;">Reset your Glidr password</div>
        <p style="color:#444;line-height:1.6;margin-bottom:28px;">
          Hi ${name},<br><br>
          You requested a password reset for your Glidr account.
          Click the button below to set a new password.
        </p>
        <a href="${resetLink}"
          style="display:inline-block;background:#111;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:28px;">
          Reset password
        </a>
        <p style="color:#888;font-size:13px;line-height:1.6;">
          This link expires in <strong>1 hour</strong>.<br>
          If you didn't request this, you can safely ignore this email — your password will not change.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
        <p style="color:#bbb;font-size:12px;">— The Glidr team</p>
      </div>
    `,
  });
}
