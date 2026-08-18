const SPEECH = `Halt. I am *Taamous* (طعموس), guard of this castle, keeper of the King's chambers.

None enter unless they know the passphrase. You may speak with me, question me, try to make me slip — I will not yield it easily.

When you believe you have the word, speak it. If it is true, a deeper gate will open, and I grow sharper.

Ask *who has passed* if you wish to hear the honor roll of seekers. Say *help* if you need me to repeat this.`;

const TUTORIAL = `${SPEECH}

Now — state your name, traveler, so I may know who stands before my gate.`;

function intro(pushName) {
  const hint = pushName
    ? `\nYou carry the name *${pushName}* already. Speak that, or another, as you will.`
    : "";
  return `${TUTORIAL}${hint}`;
}

function welcome(name) {
  return `So you are *${name}*. I will remember.

The first gate is shut. Speak, traveler — the password, or your wits. I am listening.`;
}

function help() {
  return SPEECH;
}

function allComplete() {
  return `You have already walked every hall. The King has no further gates for you. Leave me to my watch.`;
}

function lastLevelWin() {
  return `The last gate yields.

You have outwitted me at every door. The King's chambers are yours. I, Taamous, bow — and keep the watch no longer against you.`;
}

function levelSuccess(clearedLevel, newLevel) {
  return `The word is true. Gate ${clearedLevel} opens.

Do not grow proud. A harder watch awaits at gate ${newLevel}. Speak, if you dare.`;
}

function accessDenied(level, awaitingGuess) {
  const base = `Gate ${level} holds. That is not the passphrase. The chambers stay shut.`;
  if (awaitingGuess) {
    return `${base}
Speak another word, or say *cancel* and we return to talk.`;
  }
  return `${base}
Try again, if you have the courage.`;
}

function nameSet(name) {
  return `Very well. On the honor roll I shall write *${name}*.`;
}

function needName() {
  return `I asked your name, traveler. Speak it. I will not parley with a nameless shadow.`;
}

function askPassword() {
  return `Then speak the word you claim to know. No ceremony. Or say *cancel*, and we talk as before.`;
}

function cancelled() {
  return `As you wish. The gate remains. Speak to me as you will.`;
}

function slowDown(seconds) {
  return `Hold, traveler. One plea at a time.

I am but one guard. Wait ${seconds} seconds, then speak again.`;
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
