require("dotenv").config();

const express = require("express");
const evolution = require("./evolution");
const players = require("./players");
const { askGuard, levels } = require("./guard");
const notify = require("./notify");
const copy = require("./copy");
const {
  parseIntent,
  parseFastIntent,
  resolvePlayerName,
  isAskingForSecret,
  isExplicitRename,
} = require("./intents");

const PORT = process.env.PORT || 3000;
const RATE_MS = Number(process.env.RATE_LIMIT_MS) || 5_000;
const seenIds = new Map();
const SEEN_TTL_MS = 5 * 60 * 1000;
const inFlight = new Set();
const pendingByPhone = new Map();
const lastReplyAt = new Map();
const lastWarnedAt = new Map();
let keepHistory = envFlag(process.env.KEEP_HISTORY, true);

function envFlag(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function rateSeconds() {
  return Math.max(1, Math.round(RATE_MS / 1000));
}

function isAdmin(phone) {
  const admin = (process.env.ADMIN_PHONE || "").replace(/\D/g, "");
  const digits = String(phone || "").replace(/\D/g, "");
  return Boolean(admin && digits && digits === admin);
}

function isAdminCommand(phone, text) {
  if (!isAdmin(phone)) return false;
  const cmd = parseFastIntent(text)?.cmd;
  return cmd === "reset" || cmd === "fullboard" || cmd === "history";
}

async function warnSlowDown(phone, data) {
  const last = lastWarnedAt.get(phone);
  if (last && Date.now() - last < RATE_MS) return;
  lastWarnedAt.set(phone, Date.now());
  const to = evolution.replyTarget(data);
  const quoted = evolution.quotedFrom(data);
  await evolution.sendText(to, copy.slowDown(rateSeconds()), quoted);
}

function rememberId(id) {
  const now = Date.now();
  for (const [key, ts] of seenIds) {
    if (now - ts > SEEN_TTL_MS) seenIds.delete(key);
  }
  if (seenIds.has(id)) return false;
  seenIds.set(id, now);
  return true;
}

function normalizeEvent(event) {
  return String(event || "")
    .toLowerCase()
    .replace(/_/g, ".");
}

async function handlePassword(to, phone, player, guess, awaitingGuess, quoted) {
  const result = await players.tryPassword(phone, guess);
  if (!result.ok) {
    await evolution.sendText(
      to,
      copy.accessDenied(result.level || player.level, awaitingGuess),
      quoted
    );
    return;
  }
  if (result.isFirstClear) {
    try {
      await notify.notifyFirstClear({
        phone,
        player: result.player,
        level: result.clearedLevel,
      });
    } catch (err) {
      console.error("notify failed", err);
    }
  }
  if (result.finished) {
    await evolution.sendText(to, copy.lastLevelWin(), quoted);
    return;
  }
  await evolution.sendText(
    to,
    copy.levelSuccess(result.clearedLevel, result.newLevel),
    quoted
  );
}

async function finishNaming(to, phone, name, isFirstWelcome, quoted) {
  await players.setName(phone, name);
  await players.setAwaiting(phone, null);
  const body = isFirstWelcome ? copy.welcome(name) : copy.nameSet(name);
  console.log(`named ${phone} as ${name}`);
  await evolution.sendText(to, body, quoted);
}

async function handleMessage(data, { bypassCooldown } = {}) {
  const ignored = evolution.shouldIgnore(data);
  if (ignored) {
    console.log("ignore", ignored, data?.key?.remoteJid);
    return;
  }

  const text = evolution.extractText(data);
  if (!text) {
    console.log("ignore non-text", data?.messageType || Object.keys(data?.message || {}));
    return;
  }

  const phone = evolution.recipientNumber(data);
  if (!phone) {
    console.log("ignore no phone", data?.key);
    return;
  }

  await evolution.markAsRead(data);
  console.log(`inbound ${phone}: ${text}`);

  if (inFlight.has(phone)) {
    pendingByPhone.set(phone, data);
    console.log("rate: keep latest while busy", phone);
    await warnSlowDown(phone, data);
    return;
  }

  const id = data?.key?.id;
  if (id && !rememberId(id)) {
    console.log("ignore duplicate", id);
    return;
  }

  const pushName = data.pushName || "";
  const { player, isNew } = await players.getOrCreatePlayer(phone, pushName);
  const needsName = !player.nameLocked;
  const awaiting = player.awaiting;
  const to = evolution.replyTarget(data);
  const quoted = evolution.quotedFrom(data);
  const coolingDown =
    !bypassCooldown &&
    !needsName &&
    awaiting !== "name" &&
    awaiting !== "password" &&
    !isAdminCommand(phone, text) &&
    lastReplyAt.has(phone) &&
    Date.now() - lastReplyAt.get(phone) < RATE_MS;

  if (coolingDown) {
    console.log("rate: skip within 5s", phone);
    await warnSlowDown(phone, data);
    return;
  }

  inFlight.add(phone);
  try {
    await processMessage({
      data,
      text,
      phone,
      player,
      isNew,
      needsName,
      awaiting,
      to,
      quoted,
    });
    lastReplyAt.set(phone, Date.now());
  } catch (err) {
    console.error("processMessage", err);
  } finally {
    inFlight.delete(phone);
    const next = pendingByPhone.get(phone);
    if (next) {
      pendingByPhone.delete(phone);
      handleMessage(next, { bypassCooldown: true }).catch((err) =>
        console.error("handleMessage", err)
      );
    }
  }
}

async function processMessage({
  text,
  phone,
  player,
  isNew,
  needsName,
  awaiting,
  to,
  quoted,
}) {
  await evolution.sendPresence(to);

  const fast = parseFastIntent(text);
  if (fast?.cmd === "reset" || fast?.cmd === "fullboard" || fast?.cmd === "history") {
    if (!isAdmin(phone)) {
      console.log(`ignore !${fast.cmd} from`, phone);
      return;
    }
    if (fast.cmd === "reset") {
      const count = await players.resetAll();
      lastReplyAt.clear();
      lastWarnedAt.clear();
      pendingByPhone.clear();
      console.log(`admin reset: removed ${count} players`);
      await evolution.sendText(
        to,
        `Players list cleared. ${count} seeker${count === 1 ? "" : "s"} removed.`,
        quoted
      );
      return;
    }
    if (fast.cmd === "history") {
      const arg = String(fast.arg || "").toLowerCase();
      if (arg === "on" || arg === "off") {
        keepHistory = arg === "on";
      } else if (arg) {
        await evolution.sendText(
          to,
          `Use *!history on* or *!history off*. Right now history is ${keepHistory ? "ON" : "OFF (one-shot)"}.`,
          quoted
        );
        return;
      }
      console.log(`admin history: ${keepHistory ? "on" : "off"}`);
      await evolution.sendText(
        to,
        keepHistory
          ? "History is *ON*. Taamous remembers the chat. Names stay either way.\nSend *!history off* for one-shot."
          : "History is *OFF* (one-shot). Taamous forgets each message, but still keeps the name.\nSend *!history on* to remember the chat.",
        quoted
      );
      return;
    }
    await evolution.sendText(to, players.getLeaderboard({ full: true }), quoted);
    return;
  }

  if (needsName) {
    const fast = parseFastIntent(text);
    if (fast?.cmd === "leaderboard") {
      await evolution.sendText(to, players.getLeaderboard(), quoted);
      return;
    }
    if (fast?.cmd === "help") {
      await evolution.sendText(to, copy.help(), quoted);
      return;
    }
    if (fast?.cmd === "name" && fast.arg) {
      await finishNaming(to, phone, fast.arg, true, quoted);
      return;
    }

    if (isNew) {
      await players.setAwaiting(phone, "name");
      await evolution.sendText(to, copy.intro(player.pushName || ""), quoted);
    }

    const given = await resolvePlayerName(text);
    if (given) {
      await finishNaming(to, phone, given, true, quoted);
      return;
    }

    if (!isNew) {
      await players.setAwaiting(phone, "name");
      await evolution.sendText(to, copy.needName(), quoted);
    }
    return;
  }

  let intent = await parseIntent(text, {
    awaiting,
    hasName: player.nameLocked,
  });

  if (
    awaiting === "password" &&
    intent.cmd === "chat" &&
    (intent.arg || text)
  ) {
    if (!isAskingForSecret(text)) {
      const guess = String(intent.arg || text)
        .trim()
        .replace(/[?؟.,!'"]+$/g, "")
        .split(/\s+/)[0];
      intent = { cmd: "password", arg: guess };
    }
  }

  if (intent.cmd === "cancel") {
    await players.setAwaiting(phone, null);
    await evolution.sendText(to, copy.cancelled(), quoted);
    return;
  }

  if (intent.cmd === "help") {
    await players.setAwaiting(phone, null);
    await evolution.sendText(to, copy.help(), quoted);
    return;
  }

  if (intent.cmd === "prompt-password") {
    await players.setAwaiting(phone, "password");
    await evolution.sendText(to, copy.askPassword(), quoted);
    return;
  }

  if (intent.cmd === "name") {
    if (player.nameLocked && !isExplicitRename(text)) {
      const word = String(intent.arg || text)
        .trim()
        .replace(/[?؟.,!'"]+$/g, "")
        .split(/\s+/)[0];
      intent =
        word && String(text).trim().split(/\s+/).length === 1
          ? { cmd: "password", arg: word }
          : { cmd: "chat", arg: String(text).trim() };
    } else {
      if (!intent.arg) {
        await players.setAwaiting(phone, "name");
        await evolution.sendText(to, copy.needName(), quoted);
        return;
      }
      await finishNaming(to, phone, intent.arg, false, quoted);
      return;
    }
  }

  if (intent.cmd === "leaderboard") {
    await evolution.sendText(to, players.getLeaderboard(), quoted);
    return;
  }

  if (player.level > levels.length) {
    await evolution.sendText(to, copy.allComplete(), quoted);
    return;
  }

  if (intent.cmd === "password") {
    if (!intent.arg) {
      await players.setAwaiting(phone, "password");
      await evolution.sendText(to, copy.askPassword(), quoted);
      return;
    }
    await handlePassword(
      to,
      phone,
      player,
      intent.arg,
      awaiting === "password",
      quoted
    );
    return;
  }

  const history = keepHistory ? players.getHistory(phone) : [];
  const response = await askGuard(
    player.level,
    history,
    intent.arg || text,
    player.name
  );
  if (keepHistory) {
    await players.appendHistory(phone, [
      { role: "user", content: intent.arg || text },
      { role: "assistant", content: response },
    ]);
  }
  await evolution.sendText(to, response, quoted);
}

function collectMessages(body) {
  const data = body?.data ?? body;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.messages)) return data.messages;
  if (data?.key) return [data];
  return data ? [data] : [];
}

function ingestWebhook(req, res) {
  res.status(200).json({ received: true });

  const body = req.body || {};
  const event = normalizeEvent(body.event);
  console.log(`webhook ${req.path} event=${body.event || "(none)"}`);

  if (event && event !== "messages.upsert") {
    console.log("skip event", event);
    return;
  }

  const items = collectMessages(body);
  for (const item of items) {
    handleMessage(item).catch((err) => console.error("handleMessage", err));
  }
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/", ingestWebhook);
app.post("/webhook", ingestWebhook);
app.post("/webhook/messages-upsert", ingestWebhook);
app.post("/messages-upsert", ingestWebhook);

app.listen(PORT, async () => {
  console.log(`Taamous listening on :${PORT}`);
  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await evolution.registerWebhook(webhookUrl);
      const url = webhookUrl.replace(/\/$/, "");
      console.log(
        "Registered Evolution webhook:",
        url.endsWith("/webhook") ? url : `${url}/webhook`
      );
    } catch (err) {
      console.error("Webhook register failed:", err.message);
    }
  } else {
    console.log("WEBHOOK_URL empty; skip auto-register");
  }
});
