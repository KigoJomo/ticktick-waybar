import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function commandExists(command) {
  try {
    await execFileAsync("sh", ["-c", `command -v "$1"`, "tickbar", command]);
    return true;
  } catch {
    return false;
  }
}

export async function walkerExecutable() {
  return (await commandExists("omarchy-launch-walker"))
    ? "omarchy-launch-walker"
    : "walker";
}

export async function walkerInput(placeholder) {
  const executable = await walkerExecutable();
  const result = await runWalker(executable, [
    "--dmenu",
    "--inputonly",
    "--width",
    "460",
    "--minheight",
    "1",
    "--maxheight",
    "1",
    "--placeholder",
    `${placeholder}…`,
  ]);
  return result.trim();
}

export async function walkerSelect(entries, placeholder) {
  if (!entries.length) return null;
  const executable = await walkerExecutable();
  const result = await runWalker(
    executable,
    [
      "--dmenu",
      "--index",
      "--width",
      "560",
      "--minheight",
      "1",
      "--maxheight",
      "420",
      "--placeholder",
      `${placeholder}…`,
    ],
    `${entries.map((entry) => entry.label).join("\n")}\n`,
  );
  if (!result.trim()) return null;
  const index = Number(result.trim());
  return Number.isInteger(index) ? entries[index] || null : null;
}

function runWalker(executable, args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env: process.env,
      stdio: ["pipe", "pipe", "ignore"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve(stdout);
      else if (code === 1 || code === 130) resolve("");
      else reject(new Error(`Walker exited with status ${code}`));
    });
    child.stdin.end(input);
  });
}

export function notify(summary, body, urgency = "low") {
  const child = spawn("notify-send", ["-u", urgency, summary, body], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export function openUrl(url) {
  const child = spawn("xdg-open", [url], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export async function signalWaybar() {
  try {
    await execFileAsync("pkill", ["-RTMIN+12", "waybar"]);
  } catch (error) {
    if (error.code !== 1) throw error;
  }
}
