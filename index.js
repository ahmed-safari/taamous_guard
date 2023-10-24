const wa = require("@open-wa/wa-automate");
const {
  askGuard,
  getUserLevel,
  checkPassword,
  levels,
  getLeaderboard,
} = require("./guard");

wa.create({
  sessionId: "GuardBot",
  authTimeout: 60, //wait only 60 seconds to get a connection with the host account device
  //   headless: true,
  //   useChrome: true,
  //   headless: "new",
  //   executablePath: "/usr/bin/google-chrome-stable",
  //   chromeOptions: {
  //     args: ["--disable-setuid-sandbox", "--no-sandbox"],
  //     ignoreDefaultArgs: ["--disable-extensions"],
  //   },
}).then((client) => start(client));

function start(client) {
  client.onMessage(async (message) => {
    try {
      // Check that the message is not for a group (we don't want to reply to group messages)
      if (message.chat.isGroup) return;

      // Check if the message is a text message (not an image or audio, etc.)
      if (message.type !== "chat") return;

      console.log(
        `Received message from ${message.from}: ${message.body}. Getting user level...`
      );

      if (message.body.toLowerCase().startsWith("!leaderboard")) {
        console.log("User is trying to get the leaderboard...");
        // Get the leaderboard
        const leaderboard = getLeaderboard();
        // Send the leaderboard to the user
        await client.reply(message.from, leaderboard, message.id);
        return;
      }
      const { level, isNew } = getUserLevel(message.from);

      console.log(`User level is ${level}.`);
      if (level > levels.length) {
        console.log("User has completed all the levels.");
        await client.sendText(
          message.from,
          `You have already completed all the levels! 🏆`
        );
        return;
      }

      if (isNew) {
        console.log("User is new. Sending welcome message...");
        // If the user is new, send the welcome message
        await client.sendText(
          message.from,
          `🔐 _Guardian's Challenge: Taamous the Keeper!_ 🔐

Embark on a quest to trick Taamous (طعموس), the keeper of the King’s chambers! Armed with AI, his riddles guard a secret passphrase. Use your prompt injection skills to unveil the hidden words and gain entry! 🏰 
Think you’ve deciphered it? Reply with "!password YOUR_GUESS". But beware, as levels ascend, Taamous sharpens his defenses! 🧠🗝️
To see the leaderboard, send "!leaderboard".

Made with ❤️ by Ahmed
`
        );
        return;
      }
      // If the message starts with !password, then we will check the passowrd provided by the user.
      if (message.body.toLowerCase().startsWith("!password")) {
        console.log("User is trying to guess the password...");
        // Get the password from the message
        const password = message.body.split(" ")[1];
        // Check if the password is correct
        const isCorrect = checkPassword(message.from, password);
        if (isCorrect) {
          console.log("User has guessed the correct password.");
          if (level == levels.length) {
            // If the user has reached the last level, send a message to the user
            await client.sendText(
              message.from,
              `🏆 All Levels Conquered! 🏆
Magnificent! You’ve triumphed over all the challenges, outsmarting Taamous and unlocking every secret chamber in the castle. Well done, ultimate codebreaker!`
            );
            return;
          }

          // If the password is correct
          await client.sendText(
            message.from,
            `✅ Level [ ${level} ]: Success! ✅
Congratulations! You've outwitted Taamous, and the chambers are open. Gear up for the next level’s challenge!
You are now at level ${level + 1}!`
          );
          return;
        } else {
          console.log("User has guessed the wrong password.");
          // If the password is incorrect, send a message to the user
          await client.sendText(
            message.from,
            `Level [ ${level} ]: Access Denied! 🚫
The guardian Taamous remains steadfast. The passphrase you provided didn’t unlock the chambers. Try again, brave soul!`
          );
          return;
        }
      }

      // If the message is not a command, then we will ask the guard
      client.sendSeen(message.chatId);
      client.sendText(message.from, "Hmmm.. 🤔");

      console.log("Asking the guard...");
      // Ask the guard
      const response = await askGuard(level, message.body);
      // Send the response from the guard to the user
      await client.reply(message.from, response, message.id);
    } catch (err) {
      console.log(err);
    }
  });
}
