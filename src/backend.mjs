import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { asArray, inferInboxProjectId, parseCliJson } from "./domain.mjs";
import { projectRoot } from "./paths.mjs";

export function ticktickExecutable() {
  return (
    process.env.TICKBAR_TICKTICK_BIN ||
    path.join(projectRoot, "node_modules", ".bin", "ticktick")
  );
}

export async function runTickTick(args, { timeout = 20_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      ticktickExecutable(),
      args,
      {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout,
      env: process.env,
      },
      async (error, stdout, stderr) => {
        if (!error) {
          resolve({ stdout, stderr });
          return;
        }
        const signedIn = await hasStoredAccessToken();
        const detail =
          stderr ||
          stdout ||
          (signedIn
            ? error.message
            : "No access token found. Run `ticktick auth login` to sign in.");
        const wrapped = new Error(
          String(detail).trim() || "TickTick command failed",
        );
        wrapped.cause = error;
        wrapped.stdout = stdout;
        wrapped.stderr = stderr;
        wrapped.code = error.code;
        reject(wrapped);
      },
    );
  });
}

export async function listProjects() {
  const { stdout } = await runTickTick(["project", "list", "--json"]);
  return asArray(parseCliJson(stdout), ["projects", "data"]).filter(
    (project) => project && !project.closed,
  );
}

export async function listOpenTasks() {
  const { stdout } = await runTickTick([
    "task",
    "filter",
    "--status",
    "0",
    "--json",
  ]);
  return asArray(parseCliJson(stdout), ["tasks", "data"]).filter(
    (task) =>
      Number(task.status ?? 0) === 0 &&
      String(task.kind || "").toUpperCase() !== "NOTE",
  );
}

export async function fetchSnapshot() {
  const projects = await listProjects();
  const tasks = await listOpenTasks();
  const inboxId = inferInboxProjectId(tasks);
  if (inboxId && !projects.some((project) => project.id === inboxId)) {
    projects.unshift({
      id: inboxId,
      name: "Inbox",
      kind: "INBOX",
      permission: "write",
      isInbox: true,
    });
  }
  return { projects, tasks };
}

export async function createTask(title, projectId, options = {}) {
  if (!projectId) throw new Error("A TickTick project ID is required");
  const args = [
    "task",
    "create",
    "--title",
    title,
    "--project",
    projectId,
  ];
  appendOption(args, "--content", options.content);
  if (options.allDay) args.push("--all-day");
  appendOption(args, "--due-date", options.dueDate);
  appendOption(args, "--time-zone", options.timeZone);
  if (Number(options.priority) > 0) {
    appendOption(args, "--priority", String(options.priority));
  }
  if (options.tags?.length) {
    appendOption(
      args,
      "--tags",
      Array.isArray(options.tags) ? options.tags.join(",") : options.tags,
    );
  }
  if (options.items?.length) {
    appendOption(
      args,
      "--items",
      JSON.stringify(
        options.items.map((title) =>
          typeof title === "string" ? { title, status: 0 } : title,
        ),
      ),
    );
  }
  args.push("--json");
  const { stdout } = await runTickTick(args);
  return parseCliJson(stdout);
}

function appendOption(args, flag, value) {
  if (value === undefined || value === null || value === "") return;
  args.push(flag, String(value));
}

export async function completeTask(task) {
  await runTickTick(["task", "complete", task.projectId, task.id]);
}

export async function deleteTask(task) {
  await runTickTick(["task", "delete", task.projectId, task.id]);
}

export function authenticate() {
  return new Promise((resolve, reject) => {
    const child = spawn(ticktickExecutable(), ["auth", "login"], {
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", async (code, signal) => {
      if (code === 0) {
        try {
          await secureCredentials();
          resolve();
        } catch (error) {
          reject(error);
        }
      }
      else reject(new Error(`TickTick authentication failed (${signal || code})`));
    });
  });
}

export async function logout() {
  await runTickTick(["auth", "logout"]);
}

export async function secureCredentials() {
  const file = credentialFile();
  const directory = path.dirname(file);
  await fs.chmod(directory, 0o700);
  await fs.chmod(file, 0o600);
}

function credentialFile() {
  return path.join(os.homedir(), ".config", "ticktick-cli", "config.json");
}

async function hasStoredAccessToken() {
  try {
    const config = JSON.parse(await fs.readFile(credentialFile(), "utf8"));
    return typeof config.access_token === "string" && config.access_token.length > 0;
  } catch {
    return false;
  }
}
