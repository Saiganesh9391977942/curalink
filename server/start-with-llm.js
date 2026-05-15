const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const serverDir = __dirname;
const rootDir = path.resolve(serverDir, "..");
const llmDir = path.join(rootDir, "llm");
const llmPort = process.env.LLM_PORT || "8000";

process.env.LLM_URL = process.env.LLM_URL || `http://127.0.0.1:${llmPort}`;

const venvPython = path.join(
  llmDir,
  "venv",
  process.platform === "win32" ? "Scripts\\python.exe" : "bin/python"
);
const pythonCmd = process.env.PYTHON || (fs.existsSync(venvPython) ? venvPython : "python");

const children = [];

function start(name, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  children.push(child);

  child.stdout.on("data", (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });

  child.on("exit", (code) => {
    if (code && !shuttingDown) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`Starting LLM on ${process.env.LLM_URL}`);
start("LLM", pythonCmd, ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", llmPort], {
  cwd: llmDir,
});

setTimeout(() => {
  console.log(`Starting API on port ${process.env.PORT || "5000"}`);
  start("API", process.execPath, ["index.js"], { cwd: serverDir });
}, 1500);
