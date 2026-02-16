const axios = require("axios");

const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_HOST = process.env.JUDGE0_HOST;

const languageMap = {
python: 71,
cpp: 54,
c: 50,
java: 62
};

async function runCode({ code, language, input }) {
try {
const language_id = languageMap[language];

if (!language_id) {
  throw new Error("Unsupported language");
}

// 1️⃣ Submit Code
const submission = await axios.post(
  `https://${JUDGE0_HOST}/submissions?base64_encoded=false&wait=false`,
  {
    source_code: code,
    language_id,
    stdin: input
  },
  {
    headers: {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": JUDGE0_API_KEY,
      "X-RapidAPI-Host": JUDGE0_HOST
    }
  }
);

const token = submission.data.token;

// 2️⃣ Poll for Result
let result;
while (true) {
  const response = await axios.get(
    `https://${JUDGE0_HOST}/submissions/${token}?base64_encoded=false`,
    {
      headers: {
        "X-RapidAPI-Key": JUDGE0_API_KEY,
        "X-RapidAPI-Host": JUDGE0_HOST
      }
    }
  );

  result = response.data;

  if (result.status.id <= 2) {
    await new Promise(res => setTimeout(res, 1000));
  } else {
    break;
  }
}

return result;
} catch (error) {
console.error("JUDGE0 ERROR:", error.response?.data || error.message);
throw error;
}
}

module.exports = { runCode };