require("dotenv").config();

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY. Put it in a .env file (see .env.example).");
  process.exit(1);
}

require("./src/index");
