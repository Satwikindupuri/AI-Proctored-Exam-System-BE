const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const DEFAULT_TIMEOUT_MS = Number(process.env.CODE_RUN_TIMEOUT_MS || 8000);
const RUNNER_MODE = (process.env.CODE_RUNNER_MODE || "hybrid").toLowerCase();
const PISTON_EXECUTE_URL = process.env.PISTON_EXECUTE_URL || "https://emkc.org/api/v2/piston/execute";

const languageMap = {
  python: { pistonLanguage: "python", pistonVersion: "3.10.0" },
  java: { pistonLanguage: "java", pistonVersion: "15.0.2" },
  cpp: { pistonLanguage: "cpp", pistonVersion: "10.2.0" },
};

const normalizeInput = (input) => {
  if (input == null) return "";
  return String(input);
};

const localPythonRunner = ({ code, input }) => {
  return new Promise((resolve, reject) => {
    const fileName = `temp_${uuidv4()}.py`;
    const filePath = path.join(os.tmpdir(), fileName);

    fs.writeFileSync(filePath, code, "utf8");

    const child = spawn("python", [filePath], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let isTimedOut = false;

    const timeout = setTimeout(() => {
      isTimedOut = true;
      child.kill("SIGKILL");
    }, DEFAULT_TIMEOUT_MS);

    child.stdin.write(normalizeInput(input));
    child.stdin.end();

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", () => {
      clearTimeout(timeout);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      if (isTimedOut) {
        resolve({ success: false, stdout: "", stderr: "Execution timed out" });
        return;
      }

      resolve({
        success: !stderr.trim(),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(error);
    });
  });
};

const pistonRunner = async ({ language, code, input }) => {
  const lang = String(language || "").toLowerCase();
  const mapped = languageMap[lang];

  if (!mapped) {
    return {
      success: false,
      stdout: "",
      stderr: `Unsupported language: ${language}`,
    };
  }

  const payload = {
    language: mapped.pistonLanguage,
    version: mapped.pistonVersion,
    files: [{ content: code }],
    stdin: normalizeInput(input),
    run_timeout: Math.max(1000, DEFAULT_TIMEOUT_MS),
  };

  try {
    const response = await axios.post(PISTON_EXECUTE_URL, payload, {
      timeout: DEFAULT_TIMEOUT_MS + 3000,
      headers: { "Content-Type": "application/json" },
    });

    const run = response.data?.run || {};
    const stdout = String(run.stdout || "").trim();
    const stderr = String(run.stderr || "").trim();

    return {
      success: !stderr,
      stdout,
      stderr,
    };
  } catch (error) {
    return {
      success: false,
      stdout: "",
      stderr: `Runner service unavailable: ${error.message}`,
    };
  }
};

const runCode = async ({ language, code, input }) => {
  const lang = String(language || "python").toLowerCase();

  if (RUNNER_MODE === "local") {
    if (lang !== "python") {
      return {
        success: false,
        stdout: "",
        stderr: "Local mode currently supports only python. Use CODE_RUNNER_MODE=piston for Java/C++.",
      };
    }

    return localPythonRunner({ code, input });
  }

  if (RUNNER_MODE === "hybrid") {
    // For demo reliability, keep python fully offline/local.
    if (lang === "python") {
      return localPythonRunner({ code, input });
    }

    const remoteResult = await pistonRunner({ language: lang, code, input });

    // If free runner fails and language is python, transparently fallback.
    if (!remoteResult.success && lang === "python") {
      return localPythonRunner({ code, input });
    }

    return remoteResult;
  }

  return pistonRunner({ language: lang, code, input });
};

module.exports = {
  runCode,
};