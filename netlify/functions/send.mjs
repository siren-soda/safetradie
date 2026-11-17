// SafeTradie email service: emails a pre-start or SWMS PDF to up to two addresses.
// Preferred: Resend (env RESEND_API_KEY; optional MAIL_FROM, default "SafeTradie <noreply@safeinstall.org>" until SafeTradie has its own domain).
// Fallback: Gmail app password (env GMAIL_USER, GMAIL_APP_PASSWORD).
import nodemailer from "nodemailer";

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 4 MB across all PDFs (Netlify request limit is 6 MB)
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  // Only accept requests from this site's own pages
  const origin = req.headers.get("origin") || "";
  const allowed = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL].filter(Boolean);
  if (allowed.length && !allowed.some((u) => origin === u.replace(/\/$/, ""))) {
    return json(403, { ok: false, error: "Not allowed" });
  }

  const { RESEND_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  const MAIL_FROM = process.env.MAIL_FROM || "SafeTradie <noreply@safeinstall.org>";
  if (!RESEND_API_KEY && !(GMAIL_USER && GMAIL_APP_PASSWORD)) return json(503, { ok: false, error: "Email not set up" });

  let data;
  try { data = await req.json(); } catch { return json(400, { ok: false, error: "Bad request" }); }

  // Honeypot: real users never fill this in
  if (data.website) return json(200, { ok: true });

  const to = Array.isArray(data.to) ? [...new Set(data.to.map((e) => String(e).trim()).filter(Boolean))] : [];
  if (to.length < 1 || to.length > 2 || !to.every((e) => EMAIL_RE.test(e) && e.length <= 200)) {
    return json(400, { ok: false, error: "Check the email addresses" });
  }
  const replyTo = EMAIL_RE.test(String(data.replyTo || "")) ? String(data.replyTo) : undefined;

  const isPdf = (b) => b.length > 0 && b.subarray(0, 5).toString() === "%PDF-";
  const pdf = Buffer.from(String(data.pdf || ""), "base64");
  const extras = (Array.isArray(data.extra) ? data.extra : []).slice(0, 1).map((x) => ({
    filename: String((x && x.filename) || ""),
    content: Buffer.from(String((x && x.pdf) || ""), "base64"),
  }));
  const total = pdf.length + extras.reduce((n, x) => n + x.content.length, 0);
  if (!isPdf(pdf) || !extras.every((x) => isPdf(x.content)) || total > MAX_TOTAL_BYTES) {
    return json(400, { ok: false, error: "PDF missing or too large" });
  }

  const clean = (s, n) => String(s || "").replace(/[\r\n]+/g, " ").slice(0, n);
  const subject = clean(data.subject, 150) || "SafeTradie document";
  const fname = (n, d) => (clean(n, 100).replace(/[^\w.\- ]+/g, "") || d).replace(/(\.pdf)?$/i, ".pdf");
  const files = [{ filename: fname(data.filename, "SafeTradie.pdf"), content: pdf }].concat(
    extras.map((x) => ({ filename: fname(x.filename, "SWMS.pdf"), content: x.content }))
  );
  const text =
    String(data.text || "").slice(0, 6000) +
    "\n\n---\nSent from SafeTradie, a free pre-start and SWMS guidance tool for residential trades." +
    "\nThe contractor is responsible for their own safety and legal compliance." +
    (replyTo ? `\nReplies go to ${replyTo}.` : "");

  if (RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: MAIL_FROM,
          to,
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject,
          text,
          attachments: files.map((f) => ({ filename: f.filename, content: f.content.toString("base64") })),
        }),
      });
      if (!r.ok) {
        console.error("resend failed:", r.status, (await r.text()).slice(0, 300));
        return json(502, { ok: false, error: "Email failed to send" });
      }
      return json(200, { ok: true });
    } catch (err) {
      console.error("resend error:", err && err.message);
      return json(502, { ok: false, error: "Email failed to send" });
    }
  }

  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
    await transport.sendMail({
      from: `SafeTradie <${GMAIL_USER}>`,
      to,
      replyTo,
      subject,
      text,
      attachments: files.map((f) => ({ filename: f.filename, content: f.content, contentType: "application/pdf" })),
    });
    return json(200, { ok: true });
  } catch (err) {
    console.error("send failed:", err && err.message);
    return json(502, { ok: false, error: "Email failed to send" });
  }
};

export const config = { path: "/api/send" };
