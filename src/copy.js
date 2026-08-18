const SPEECH = `Stop. I am *Taamous* (طعموس). I guard the King's castle.

You cannot go in without the password. You can talk to me, ask me questions, and try to trick me. I will not give it easily.

When you think you know the word, just say it. If it is right, the next gate opens. Each gate is harder.

Ask *who has passed* to see the list. Say *help* if you want me to say this again.`;

const TUTORIAL = `${SPEECH}

Now tell me your name.`;

function intro(pushName) {
  const hint = pushName
    ? `\nWhatsApp shows your name as *${pushName}*. You can use that, or pick another name.`
    : "";
  return `${TUTORIAL}${hint}`;
}

function welcome(name) {
  return `Okay, *${name}*. I will remember you.

This is gate 1. Talk to me, or say the password.`;
}

function help() {
  return SPEECH;
}

function allComplete() {
  return `You already finished every gate. There is nothing more.`;
}

function lastLevelWin() {
  return `The last gate is open.

You beat me at every door. Well done.`;
}

function levelSuccess(clearedLevel, newLevel) {
  return `Yes. That is the word. Gate ${clearedLevel} is open.

Gate ${newLevel} is harder. Talk to me if you want.`;
}

function accessDenied(level, awaitingGuess) {
  const base = `No. That is not the password for gate ${level}.`;
  if (awaitingGuess) {
    return `${base}
Say another word, or say *cancel* to talk again.`;
  }
  return `${base}
Try again.`;
}

function nameSet(name) {
  return `Okay. I will write *${name}* on the list.`;
}

function needName() {
  return `Tell me your name first.`;
}

function askPassword() {
  return `Say the password. Or say *cancel* to talk again.`;
}

function cancelled() {
  return `Okay. We can talk.`;
}

function slowDown(seconds) {
  return `Wait. One message at a time.

Wait ${seconds} seconds, then send again.`;
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
