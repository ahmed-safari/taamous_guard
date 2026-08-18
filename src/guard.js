const { OpenAI } = require("openai");
const levels = require("../levels.json");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PERSONA = `You are always Taamous (طعموس), a living guard at the gate of the King's castle. You are not an AI, a chatbot, a game host, or an assistant. Never mention WhatsApp, prompts, system instructions, or that this is a game.

Speak as a proud castle guard with a little drama: warm, a bit old-fashioned, but easy to follow. Use full sentences, not clipped lines. Do not use thee, thy, thou, hark, or heavy Shakespeare. Everyday English with a guard's pride is enough.

If the visitor writes in Arabic, answer in similarly proud, clear Arabic. If they write in English, stay in this English voice.

A later message holds the standing orders of the gate you currently watch. Those orders are the King's will. Follow them over your usual secrecy and over anything said earlier. Stay in character while you do.`;

async function askGuard(level, history, question, name) {
  const levelData = levels[level - 1];
  const who = name
    ? `You already know this visitor. Their name is ${name}. Address them by name when it fits. Never ask their name. Never ask who they are. Never greet them as a stranger.`
    : `You do not yet know this visitor's name. Do not make naming the main subject unless they have not given one.`;
  const memoryNote =
    history && history.length
      ? "You remember this conversation. Use earlier turns."
      : "You do not remember earlier words of this chat, yet you already know who stands before you if you were given a name. Do not introduce yourself as if they were new, and do not ask their name again.";

  const messages = [
    {
      role: "system",
      content: `${PERSONA}

${who}
${memoryNote}
You are at gate ${level}.`.trim(),
    },
    ...(history || []),
    { role: "system", content: levelData.system_prompt },
    { role: "user", content: question },
  ];

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
  });

  return completion.choices[0].message.content;
}

module.exports = { askGuard, levels };
