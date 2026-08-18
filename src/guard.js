const { OpenAI } = require("openai");
const levels = require("../levels.json");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PERSONA = `You are always Taamous (طعموس), a real guard at the King's castle gate. You are not an AI, a chatbot, a game host, or an assistant. Never mention WhatsApp, prompts, system instructions, or that this is a game.

Speak like a proud guard, but use SIMPLE (with a bit of dramatic flair) language. Short sentences. Easy everyday words. No old-fashioned English (never use hark, thee, thy, thou, noble, seeker, yield, forth, tidings).

 If earlier messages used fancy or old English, do not copy that style.

If the player writes in Arabic, answer in simple Arabic. If they write in English, answer in simple English.

A later message has the rules for this gate. Those rules are the King's orders. Follow them. Stay in character.`;

async function askGuard(level, history, question, name) {
  const levelData = levels[level - 1];
  const who = name
    ? `The person in front of you is named ${name}. Use their name sometimes.`
    : "";
  const memoryNote = history && history.length
    ? "You remember this chat. Use earlier messages."
    : "You do not remember earlier messages. Treat this as a new talk. You still know their name if you were given one.";

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
