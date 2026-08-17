const fs = require("fs");
const path = require("path");
const { sendText } = require("./evolution");
const { displayName } = require("./players");

const LOG_PATH = path.join(__dirname, "..", "data", "clears.jsonl");

function ensureLogDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function notifyFirstClear({ phone, player, level }) {
  const name = displayName(player, phone);
  const digits = String(phone).replace(/\D/g, "");
  const fullNumber = digits ? `+${digits}` : String(phone);
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    name: player.name || "",
    phone: digits || phone,
    level,
  });

  ensureLogDir();
  fs.appendFileSync(LOG_PATH, `${line}\n`);

  const admin = (process.env.ADMIN_PHONE || "").replace(/\D/g, "");
  if (!admin) {
    console.log("ADMIN_PHONE not set; skip WhatsApp notify");
    return;
  }

  await sendText(admin, `${name} (${fullNumber}) cleared level ${level}`);
}

module.exports = { notifyFirstClear };
