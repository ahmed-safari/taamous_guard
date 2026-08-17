const BASE = () => (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
const INSTANCE = () => process.env.EVOLUTION_INSTANCE;
const API_KEY = () => process.env.EVOLUTION_API_KEY;

async function evoFetch(path, body) {
  const url = `${BASE()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: API_KEY(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution ${path} ${res.status}: ${text}`);
  }
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function quotedFrom(data) {
  if (!data?.key?.id || !data?.key?.remoteJid) return null;
  const text = extractText(data);
  const quoted = {
    key: {
      id: data.key.id,
      fromMe: Boolean(data.key.fromMe),
      remoteJid: data.key.remoteJid,
    },
  };
  if (data.key.participant) quoted.key.participant = data.key.participant;
  if (data.message) quoted.message = data.message;
  else if (text) quoted.message = { conversation: text };
  return quoted;
}

function sendText(number, text, quoted) {
  return sendTextPayloads(number, text, quoted);
}

async function sendTextPayloads(number, text, quoted) {
  const bases = [
    { number, text },
    { number, textMessage: { text } },
  ];
  const payloads = [];
  for (const base of bases) {
    if (quoted) payloads.push({ ...base, quoted });
    payloads.push(base);
  }
  let lastErr;
  for (const body of payloads) {
    try {
      const result = await evoFetch(
        `/message/sendText/${encodeURIComponent(INSTANCE())}`,
        body
      );
      console.log("sent text to", number);
      return result;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function replyTarget(data) {
  const jid = data?.key?.remoteJid;
  if (
    jid &&
    !jid.includes("@g.us") &&
    jid !== "status@broadcast"
  ) {
    return jid;
  }
  return recipientNumber(data);
}

async function sendPresence(number) {
  try {
    await evoFetch(`/chat/sendPresence/${encodeURIComponent(INSTANCE())}`, {
      number,
      delay: 1200,
      presence: "composing",
    });
  } catch (err) {
    console.log("presence failed:", err.message);
  }
}

async function markAsRead(data) {
  const key = data?.key;
  if (!key?.id || !key?.remoteJid) return;
  try {
    await evoFetch(`/chat/markMessageAsRead/${encodeURIComponent(INSTANCE())}`, {
      readMessages: [
        {
          remoteJid: key.remoteJid,
          fromMe: Boolean(key.fromMe),
          id: key.id,
        },
      ],
    });
  } catch (err) {
    console.log("markAsRead failed:", err.message);
  }
}

function registerWebhook(webhookUrl) {
  const url = webhookUrl.replace(/\/$/, "");
  const endpoint = url.endsWith("/webhook") ? url : `${url}/webhook`;
  return evoFetch(`/webhook/set/${encodeURIComponent(INSTANCE())}`, {
    webhook: {
      enabled: true,
      url: endpoint,
      byEvents: false,
      base64: false,
      webhookByEvents: false,
      webhookBase64: false,
      events: ["MESSAGES_UPSERT"],
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    },
  });
}

function normalizeNumber(jidOrNumber) {
  return String(jidOrNumber || "").replace(/\D/g, "");
}

function recipientNumber(data) {
  const key = data?.key || {};
  const candidates = [
    key.remoteJidAlt,
    key.senderPn,
    key.participantAlt,
    data.senderPn,
    data.sender,
    key.remoteJid,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "");
    if (!value) continue;
    if (value.includes("@g.us") || value.includes("status@broadcast")) continue;
    if (value.includes("@lid")) continue;
    const digits = normalizeNumber(value);
    if (digits) return digits;
  }
  return normalizeNumber(key.remoteJidAlt || key.remoteJid);
}

function shouldIgnore(data) {
  const jid = data?.key?.remoteJid || "";
  if (data?.key?.fromMe) return "fromMe";
  if (jid.includes("@g.us")) return "group";
  if (jid === "status@broadcast") return "status";
  return null;
}

function unwrapMessage(msg) {
  if (!msg) return null;
  const inner =
    msg.ephemeralMessage?.message ||
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message;
  if (inner) return unwrapMessage(inner);
  return msg;
}

function extractText(data) {
  if (typeof data?.text === "string" && data.text.trim()) return data.text;
  const msg = unwrapMessage(data?.message);
  if (!msg) return null;
  if (typeof msg.conversation === "string") return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  return null;
}

module.exports = {
  sendText,
  sendPresence,
  markAsRead,
  registerWebhook,
  normalizeNumber,
  recipientNumber,
  replyTarget,
  quotedFrom,
  extractText,
  shouldIgnore,
};
