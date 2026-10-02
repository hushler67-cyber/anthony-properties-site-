// Vercel Function (Node.js runtime — the current default and recommended
// approach; Vercel's standalone Edge Functions are deprecated).
// Any file in /api automatically becomes an endpoint, so this is live at
// POST /api/submit with no extra config needed.
//
// Bot token and chat ID are set directly below.

const TELEGRAM_BOT_TOKEN = "8488713656:AAE3obLq6tg4ALAdmGK6MAygjitGD9aDN04";
const TELEGRAM_CHAT_ID = "7378109575";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const BOT_TOKEN = TELEGRAM_BOT_TOKEN;
  const CHAT_ID = TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || BOT_TOKEN.startsWith("PASTE_") || !CHAT_ID || CHAT_ID.startsWith("PASTE_")) {
    res.status(500).json({ ok: false, error: "Server not configured" });
    return;
  }

  // Vercel automatically parses the JSON body for Node.js functions,
  // so req.body is already an object here (no req.json() needed).
  const body = req.body || {};
  const { text, signature } = body; // signature is a base64 PNG data URL, or null

  if (!text || typeof text !== "string") {
    res.status(400).json({ ok: false, error: "Missing text" });
    return;
  }

  const base = `https://api.telegram.org/bot${BOT_TOKEN}`;

  try {
    // 1. Send the text summary
    const msgRes = await fetch(`${base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" })
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text();
      res.status(502).json({ ok: false, error: "Telegram message failed", detail: errText });
      return;
    }

    // 2. Send the signature image, if one was provided
    if (signature && typeof signature === "string" && signature.startsWith("data:image")) {
      try {
        const base64 = signature.split(",")[1];
        const buffer = Buffer.from(base64, "base64");
        const blob = new Blob([buffer], { type: "image/png" });

        const fd = new FormData();
        fd.append("chat_id", CHAT_ID);
        fd.append("caption", "Signature");
        fd.append("photo", blob, "signature.png");

        const photoRes = await fetch(`${base}/sendPhoto`, { method: "POST", body: fd });
        if (!photoRes.ok) {
          const errText = await photoRes.text();
          res.status(200).json({ ok: true, warning: "Signature photo failed", detail: errText });
          return;
        }
      } catch (err) {
        res.status(200).json({ ok: true, warning: "Signature photo failed", detail: String(err) });
        return;
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Unexpected server error", detail: String(err) });
  }
}
