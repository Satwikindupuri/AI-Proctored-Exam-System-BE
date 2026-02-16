require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

console.log("Loaded Key:", process.env.GEMINI_API_KEY);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
try {
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const result = await model.generateContent("Say hello in one sentence.");
console.log("AI RESPONSE:", result.response.text());
} catch (err) {
console.error("TEST ERROR:", err);
}
}

test();
