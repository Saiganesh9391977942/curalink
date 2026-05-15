const { spawn } = require("child_process");
const path = require("path");

const rootDir = __dirname;
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];
let shuttingDown = false;

function start(name, command, args, cwd) {
  const useCmd = process.platform === "win32" && command.endsWith(".cmd");
  const child = spawn(
    useCmd ? process.env.ComSpec || "cmd.exe" : command,
    useCmd ? ["/d", "/s", "/c", [command, ...args].join(" ")] : args,
    {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    }
  );

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
}

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("backend", npmCmd, ["run", "start:full"], path.join(rootDir, "server"));

setTimeout(() => {
  start("client", npmCmd, ["run", "dev", "--", "--host", "127.0.0.1"], path.join(rootDir, "client"));
}, 2500);
