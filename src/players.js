const fs = require("fs");
const path = require("path");
const levels = require("../levels.json");

const PLAYERS_PATH = path.join(__dirname, "..", "players.json");
const HISTORY_LIMIT = 16;

let queue = Promise.resolve();

function load() {
  try {
    return JSON.parse(fs.readFileSync(PLAYERS_PATH, "utf8"));
  } catch {
    return {};
  }
}

function save(players) {
  fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2));
}

function withStore(fn) {
  const run = queue.then(() => {
    const players = load();
    const result = fn(players);
    save(players);
    return result;
  });
  queue = run.then(
    () => {},
    (err) => {
      console.error("player store:", err);
    }
  );
  return run;
}

function maskPhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 6) return digits;
  return `+${digits.slice(0, 3)}***${digits.slice(-3)}`;
}

function displayName(player, phone) {
  return (player && player.name) || maskPhone(phone);
}

function lastDigits(phone, n = 3) {
  const digits = String(phone).replace(/\D/g, "");
  return digits.slice(-n);
}

function getOrCreatePlayer(phone, pushName) {
  return withStore((players) => {
    const existing = players[phone];
    if (existing) {
      if (pushName) existing.pushName = pushName;
      return {
        player: { ...existing, history: [...(existing.history || [])] },
        isNew: false,
      };
    }

    const player = {
      name: "",
      pushName: pushName || "",
      nameLocked: false,
      level: 1,
      clearedLevels: [],
      history: [],
      awaiting: "name",
    };
    players[phone] = player;
    return { player: { ...player, history: [] }, isNew: true };
  });
}

function setName(phone, name) {
  return withStore((players) => {
    if (!players[phone]) return null;
    players[phone].name = name;
    players[phone].nameLocked = true;
    return { ...players[phone] };
  });
}

function setAwaiting(phone, awaiting) {
  return withStore((players) => {
    if (!players[phone]) return null;
    players[phone].awaiting = awaiting || null;
    return { ...players[phone] };
  });
}

function getHistory(phone) {
  const players = load();
  return [...(players[phone]?.history || [])];
}

function appendHistory(phone, entries) {
  const list = Array.isArray(entries) ? entries : [entries];
  return withStore((players) => {
    const player = players[phone];
    if (!player) return;
    player.history = player.history || [];
    player.history.push(...list);
    if (player.history.length > HISTORY_LIMIT) {
      player.history = player.history.slice(-HISTORY_LIMIT);
    }
  });
}

function tryPassword(phone, guess) {
  return withStore((players) => {
    const player = players[phone];
    if (!player) return { ok: false, reason: "no-player" };
    if (player.level > levels.length) {
      return { ok: false, reason: "complete", level: player.level };
    }

    const current = levels[player.level - 1];
    if (
      !guess ||
      current.answer.toLowerCase() !== String(guess).toLowerCase()
    ) {
      return { ok: false, reason: "wrong", level: player.level };
    }

    const clearedLevel = player.level;
    const isFirstClear = !(player.clearedLevels || []).includes(clearedLevel);
    if (isFirstClear) {
      player.clearedLevels = [...(player.clearedLevels || []), clearedLevel];
    }
    player.level += 1;
    player.history = [];
    player.awaiting = null;

    return {
      ok: true,
      clearedLevel,
      isFirstClear,
      newLevel: player.level,
      finished: player.level > levels.length,
      player: { ...player },
    };
  });
}

function getLeaderboard({ full = false } = {}) {
  const players = load();
  const sorted = Object.keys(players).sort(
    (a, b) => players[b].level - players[a].level
  );
  const rows = full ? sorted : sorted.slice(0, 10);

  let board = full
    ? "📜 *Honor roll (admin)* 📜\n\n"
    : "📜 *The honor roll of seekers* 📜\n\n";
  if (!rows.length) {
    board += "No seekers yet.";
    return board;
  }
  rows.forEach((phone, index) => {
    const player = players[phone];
    const name = (player && player.name) || "unnamed";
    const digits = String(phone).replace(/\D/g, "");
    const shown = full
      ? digits
        ? `+${digits}`
        : String(phone)
      : `…${lastDigits(phone)}`;
    board += `${index + 1}. ${name} (${shown}) — gate ${player.level}\n`;
  });
  return board;
}

function resetAll() {
  return withStore((players) => {
    const count = Object.keys(players).length;
    for (const key of Object.keys(players)) delete players[key];
    return count;
  });
}

module.exports = {
  getOrCreatePlayer,
  setName,
  setAwaiting,
  getHistory,
  appendHistory,
  tryPassword,
  getLeaderboard,
  resetAll,
  maskPhone,
  displayName,
};
