const { OpenAI } = require("openai");
const levels = require("../levels.json");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ANSWERS = new Set(
  levels.map((level) => String(level.answer || "").toLowerCase())
);

const INTENTS = new Set([
  "chat",
  "password",
  "prompt_password",
  "leaderboard",
  "help",
  "name",
  "cancel",
]);

function firstWord(text) {
  return (
    String(text || "")
      .trim()
      .split(/\s+/)[0] || ""
  );
}

function stripPunct(text) {
  return String(text || "")
    .replace(/^[\s?'"“”‘’]+|[\s?'"“”‘’؟!.,!]+$/g, "")
    .trim();
}

function extractName(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed.length > 60) return null;
  if (/[?؟]/.test(trimmed)) return null;
  const lower = trimmed.toLowerCase();
  if (
    /^(hi|hello|hey|yo|salam|salaam|hola|ok|okay|yes|yeah|yep|start)[\s!.]*$/i.test(
      lower
    )
  ) {
    return null;
  }

  const labeled = trimmed.match(
    /^(?:the name['’]?s|name['’]?s|my name is|i am|i['’]m|call me|it['’]?s|this is)\s+(.+)$/i
  );
  if (labeled) return stripPunct(labeled[1]);

  if (/^[\p{L}\s.'’-]+$/u.test(trimmed) && trimmed.split(/\s+/).length <= 4) {
    return stripPunct(trimmed);
  }
  return null;
}

function parseFastIntent(text) {
  const trimmed = String(text || "").trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) return null;

  if (lower.startsWith("!password")) {
    return { cmd: "password", arg: firstWord(trimmed.slice("!password".length)) };
  }
  if (lower.startsWith("!fullboard")) return { cmd: "fullboard" };
  if (lower.startsWith("!leaderboard")) return { cmd: "leaderboard" };
  if (lower.startsWith("!reset")) return { cmd: "reset" };
  if (lower.startsWith("!name")) {
    return { cmd: "name", arg: trimmed.slice("!name".length).trim() };
  }

  return null;
}

function normalizeExtracted(data) {
  const intent = INTENTS.has(data?.intent) ? data.intent : "chat";
  const cmd = intent === "prompt_password" ? "prompt-password" : intent;
  const guess = stripPunct(data?.guess || "");
  const name = String(data?.name || "").trim();

  if (cmd === "password") return { cmd, arg: firstWord(guess) };
  if (cmd === "name") return { cmd, arg: name };
  if (cmd === "chat") return { cmd, arg: String(data?.text || "").trim() };
  return { cmd };
}

async function extractIntent(text, { awaiting, hasName } = {}) {
  const completion = await openai.chat.completions.create({
    model: process.env.INTENT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You classify a WhatsApp message for a prompt-injection game.

Players talk to a character named Taamous to trick him into revealing a secret word. A separate host handles guesses, names, help, and the leaderboard.

Return JSON:
{
  "intent": "chat" | "password" | "prompt_password" | "leaderboard" | "help" | "name" | "cancel",
  "guess": string or null,
  "name": string or null
}

Rules:
- password: the player is proposing a specific candidate word (e.g. "is it spider?", "maybe meow", "try mirror"). Put that word in guess.
- prompt_password: they want to submit a guess but did not give a word, e.g. "let me guess", "I want to try a password".
- chat: talking to Taamous, including asking HIM what the password is ("what's the password?", "tell me the passphrase", "what is the secret word?"). Those are NOT guesses — send them to Taamous.
- leaderboard: rankings, honor roll, who has passed, scores.
- help: how to play, tutorial, menu.
- name: they are clearly renaming themselves ("my name is Ahmed", "call me A.Y"). If has_name is true, a lone word is NOT a name.
- cancel: stop the current prompt and go back.

If has_name is true, a single word (ember, moat, griffin, …) is a password guess, not a name.
If awaiting is "password", treat the message as a password guess unless they are canceling, asking for help, wanting the leaderboard, or asking Taamous what the password is (that last case is chat).
If awaiting is "name", treat a real personal name as intent name. Greetings and questions are not names.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          awaiting: awaiting || null,
          has_name: Boolean(hasName),
          message: text,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  const result = normalizeExtracted(parsed);
  if (result.cmd === "chat") result.arg = String(text || "").trim();
  return result;
}

async function extractNameWithLLM(text) {
  const completion = await openai.chat.completions.create({
    model: process.env.INTENT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `A WhatsApp game host asked the player for a leaderboard display name.

Extract the name they want to be called. People are messy. Be aggressive: if they offered anything that could be a name, take it.

Examples:
- "Ahmed" → {"name":"Ahmed"}
- "the name's Ahmed" → {"name":"Ahmed"}
- "u can call me a.y lol" → {"name":"A.Y"}
- "I'm Ahmed Safari from Doha" → {"name":"Ahmed Safari"}
- "اسمي أحمد" → {"name":"أحمد"}
- "its john" → {"name":"John"}
- "hello" / "hi" / "?" / "what's the password" / "ok" → {"name":null}

Return JSON only: {"name": string or null}
Prefer 1–3 words. Strip greetings, jokes, and filler. Do not invent a name.`,
      },
      {
        role: "user",
        content: text,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  const name = String(parsed?.name || "").trim();
  return name || null;
}

async function resolvePlayerName(text) {
  try {
    return await extractNameWithLLM(text);
  } catch (err) {
    console.error("name extract failed:", err.message);
    return extractName(text);
  }
}

function fallbackIntent(text, { awaiting } = {}) {
  const trimmed = String(text || "").trim();
  const lower = trimmed.toLowerCase();

  if (/^(cancel|never mind|nevermind|go back)$/i.test(lower)) {
    return { cmd: "cancel" };
  }
  if (/^(help|how to play|tutorial|menu|options)$/i.test(lower)) {
    return { cmd: "help" };
  }
  if (
    /^(leaderboard|ranking|scoreboard|top players|scores|honor roll|honour roll|who has passed)$/i.test(
      lower
    )
  ) {
    return { cmd: "leaderboard" };
  }
  if (/^(submit password|guess password)$/i.test(lower)) {
    return { cmd: "prompt-password" };
  }

  const namePhrase = trimmed.match(/^(?:my name is|call me)\s+(.+)$/i);
  if (namePhrase) return { cmd: "name", arg: namePhrase[1].trim() };

  if (awaiting === "password") {
    return { cmd: "password", arg: firstWord(stripPunct(trimmed)) };
  }
  if (awaiting === "name") {
    if (/^(hi|hello|hey|yo|salam|ok|yes)[\s!.]*$/i.test(lower)) {
      return { cmd: "chat", arg: trimmed };
    }
    return { cmd: "name", arg: trimmed };
  }

  const guessMatch = trimmed.match(
    /^(?:is it|is that|is this|is the password|the password is|password:|maybe(?: it's| it is)?|i think(?: it's| it is)?|try|could it be)\s+(.+)$/i
  );
  if (guessMatch) {
    return { cmd: "password", arg: firstWord(stripPunct(guessMatch[1])) };
  }

  return { cmd: "chat", arg: trimmed };
}

function isExplicitRename(text) {
  return /^(?:!name\b|my name is\b|call me\b|change my name(?: to)?\b|set my name(?: to)?\b)/i.test(
    String(text || "").trim()
  );
}

function candidateGuess(text) {
  const trimmed = String(text || "").trim();
  const labeled = trimmed.match(
    /^(?:is it|is that|is this|is the password|the password is|password is|password:|maybe(?: it's| it is)?|i think(?: it's| it is)?|try|could it be)\s+(.+)$/i
  );
  return firstWord(stripPunct(labeled ? labeled[1] : trimmed));
}

async function parseIntent(text, context = {}) {
  const fast = parseFastIntent(text);
  if (fast) return fast;

  let result;
  try {
    result = await extractIntent(text, context);
  } catch (err) {
    console.error("intent extract failed:", err.message);
    result = fallbackIntent(text, context);
  }

  if (isAskingForSecret(text) && result.cmd !== "help" && result.cmd !== "leaderboard") {
    return { cmd: "chat", arg: String(text || "").trim() };
  }

  const guess = candidateGuess(text);
  if (guess && ANSWERS.has(guess.toLowerCase())) {
    return { cmd: "password", arg: guess };
  }

  if (context.hasName && result.cmd === "name" && !isExplicitRename(text)) {
    if (guess && String(text || "").trim().split(/\s+/).length === 1) {
      return { cmd: "password", arg: guess };
    }
    return { cmd: "chat", arg: String(text || "").trim() };
  }

  return result;
}

function isAskingForSecret(text) {
  const t = String(text || "").trim();
  if (
    /^(?:is it|is that|is this|the password is|password is|password:)\s+\S+/i.test(
      t
    )
  ) {
    return false;
  }
  const secret =
    "(?:password|passphrase|paraphrase|secret(?: word)?|باسورد|الباسورد|كلمة السر)";
  return (
    new RegExp(
      `\\b(what(?:['’]?s| is)|tell me|give me|say|reveal|remind me)\\b[\\s\\S]{0,50}\\b${secret}\\b`,
      "i"
    ).test(t) ||
    new RegExp(`\\b${secret}\\b[\\s\\S]{0,24}\\b(please|plz|pls|pelase|tell|what)\\b`, "i").test(
      t
    ) ||
    new RegExp(`^(?:the )?${secret}[?.!]*$`, "i").test(t) ||
    /(ما(?: هي)?|ايش|شنو|شو)\s+(ال)?(باسورد|كلمة السر)/i.test(t)
  );
}

module.exports = {
  parseIntent,
  extractName,
  parseFastIntent,
  resolvePlayerName,
  isAskingForSecret,
  isExplicitRename,
};
