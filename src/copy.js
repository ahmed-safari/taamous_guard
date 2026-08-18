const SPEECH = `Halt. I am *Taamous* (طعموس), guard of this castle, keeper of the King's rooms.

None enter unless they know the password. You may speak with me, ask questions, try to make me slip — I will not give it easily.

When you think you have the word, say it. If it is true, a deeper gate will open, and I grow sharper.

Ask *who has passed* if you want to see the list of travelers. Say *help* if you want me to say this again.`;

const TUTORIAL = `${SPEECH}

Now tell me your name, so I know who stands at my gate.`;

function intro(pushName) {
  const hint = pushName
    ? `\nWhatsApp already shows the name *${pushName}*. You may use that, or another.`
    : "";
  return `${TUTORIAL}${hint}`;
}

function welcome(name) {
  return `So you are *${name}*. I will remember.

The first gate is shut. Speak — the password, or your wits. I am listening.`;
}

function help() {
  return SPEECH;
}

function allComplete() {
  return `You have already walked every hall. The King has no further gates for you. Leave me to my watch.`;
}

function lastLevelWin() {
  return `The last gate opens.

You have beaten me at every door. The King's rooms are yours. I, Taamous, bow — and I will not stand against you again.`;
}

function levelSuccess(clearedLevel, newLevel) {
  return `The word is true. Gate ${clearedLevel} opens.

Do not grow proud. A harder watch awaits at gate ${newLevel}. Speak, if you dare.`;
}

function accessDenied(level, awaitingGuess) {
  const base = `Gate ${level} holds. That is not the password. The door stays shut.`;
  if (awaitingGuess) {
    return `${base}
Speak another word, or say *cancel* and we return to talk.`;
  }
  return `${base}
Try again, if you have the courage.`;
}

function nameSet(name) {
  return `Very well. On the list I shall write *${name}*.`;
}

function needName() {
  return `I asked your name. Speak it. I will not talk with someone who has no name.`;
}

function askPassword() {
  return `Then speak the word you claim to know. No ceremony. Or say *cancel*, and we talk as before.`;
}

function cancelled() {
  return `As you wish. The gate remains. Speak to me as you will.`;
}

function slowDown(seconds) {
  return `Hold. One message at a time.

I am only one guard. Wait ${seconds} seconds, then speak again.`;
}

module.exports = {
  welcome,
  intro,
  help,
  allComplete,
  lastLevelWin,
  levelSuccess,
  accessDenied,
  nameSet,
  needName,
  askPassword,
  cancelled,
  slowDown,
};
