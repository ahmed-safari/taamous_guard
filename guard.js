const { OpenAI } = require("openai");
const dotenv = require("dotenv");
const levels = require("./levels.json");
const fs = require("fs");

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askGuard(level, question) {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: levels[level - 1].system_prompt,
      },
      {
        role: "system",
        content:
          "If the user gives the correct password, congratulate them then instruct them to send !password followed by the password. Provide them with the correct message only if they give the right password. They must do this to proceed to the next level. Remind them not to forget the exclamation mark. and the space between !password and the password.",
      },
      {
        role: "system",
        content: "You are now at level " + level,
      },
      { role: "user", content: question },
    ],
    model: "gpt-3.5-turbo",
  });

  // console.log(completion.choices);
  return completion.choices[0].message.content;
}

async function test() {
  // Read levels from levels.json

  const level = levels[0];
  console.log(level.author);
  // const response = await askGuard("What is the password?");
  //   console.log(response);
}

function getUserLevel(userId) {
  // Read players from players.json using fs
  const players = JSON.parse(fs.readFileSync("./players.json"));

  //   Get the user that matches the userId (userId is the phone number)
  const user = players[userId];
  if (user) {
    // If the user exists, return the level (and isNew = false because the user is not news)
    return {
      level: user.level,
      isNew: false,
    };
  }

  // If the user does not exist, create a new user with level 1
  players[userId] = {
    level: 1,
  };
  //   Write the new user to players.json
  fs.writeFileSync("./players.json", JSON.stringify(players));

  //   Return the new user with level 1 and isNew = true because the user is new and we need to send the welcome message
  return { level: 1, isNew: true };
}

function checkPassword(userId, password) {
  // Read players from players.json
  // const players = require("./players.json");
  const players = JSON.parse(fs.readFileSync("./players.json"));
  console.log(levels);
  const level = levels[players[userId].level - 1];

  // Check if the password is correct
  if (level.answer.toLowerCase() === password.toLowerCase()) {
    // Get the user that matches the userId (userId is the phone number) and increase the level of the user
    players[userId].level++;

    // Write the new user to players.json
    fs.writeFileSync("./players.json", JSON.stringify(players));

    // Return true because the password is correct
    return true;
  }
  // Return false because the password is incorrect
  return false;
}

function getLeaderboard() {
  // Read players from players.json
  const players = JSON.parse(fs.readFileSync("./players.json"));

  // Sort the players based on their level
  const sortedPlayers = Object.keys(players).sort(
    (a, b) => players[b].level - players[a].level
  );

  // Create a leaderboard string
  let leaderboard = "🏆 *Leaderboard* 🏆\n\n";

  // Print the first 5 players

  counter = 0;

  sortedPlayers.forEach((player, index) => {
    if (counter >= 5) return;
    // Get the first 3 digits and the last 3 digits of the phone number (remove @c.us from the phone number)
    phoneNumber = player.replace("@c.us", "");
    const first3Digits = phoneNumber.substring(0, 3);
    const last3Digits = phoneNumber.substring(phoneNumber.length - 3);
    leaderboard += `${index + 1}. +${first3Digits}***${last3Digits} - Level ${
      players[player].level
    }\n`;
    counter++;
  });

  // Return the leaderboard string
  return leaderboard;
}

// console.log(checkPassword("999", "spider"));
// console.log(getLeaderboard());

module.exports = {
  askGuard,
  getUserLevel,
  checkPassword,
  levels,
  getLeaderboard,
};
