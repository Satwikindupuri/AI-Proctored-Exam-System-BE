const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

exports.runPython = (code, input) => {
return new Promise((resolve, reject) => {

const fileName = `temp_${uuidv4()}.py`;
const filePath = path.join(__dirname, fileName);

fs.writeFileSync(filePath, code);

const process = spawn("python", [filePath], {
  timeout: 5000
});

let output = "";
let error = "";

if (input) {
  process.stdin.write(input);
}

process.stdin.end();

process.stdout.on("data", (data) => {
  output += data.toString();
});

process.stderr.on("data", (data) => {
  error += data.toString();
});

process.on("close", (code) => {

  fs.unlinkSync(filePath);

  if (error) {
    return resolve({ success: false, stdout: "", stderr: error.trim() });
  }

  resolve({ success: true, stdout: output.trim(), stderr: "" });
});

process.on("error", (err) => {
  fs.unlinkSync(filePath);
  reject(err);
});
});
};

exports.runCode = async ({ language, code, input }) => {
  if (language === "python") {
    return await exports.runPython(code, input);
  }
  throw new Error(`Unsupported language: ${language}`);
};