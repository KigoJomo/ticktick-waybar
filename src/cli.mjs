#!/usr/bin/env node
import * as backend from "./backend.mjs";
import { invalidateCache, readCache } from "./cache.mjs";
import { loadConfig } from "./config.mjs";
import { getSnapshot } from "./data.mjs";
import {
  notify,
  openUrl,
  signalWaybar,
  walkerInput,
  walkerSelect,
} from "./desktop.mjs";
import { buildWaybarStatus, errorStatus } from "./domain.mjs";
import {
  addTask,
  chooseTask,
  completeSelectedTask,
} from "./service.mjs";

const command = process.argv[2] || "status";

try {
  await dispatch(command, process.argv.slice(3));
} catch (error) {
  if (command === "status") {
    const config = await loadConfig().catch(() => ({
      timeZone: "UTC",
      tooltipLimit: 8,
    }));
    const cached = error.cached || (await readCache().catch(() => null));
    printJson(errorStatus(error, cached?.tasks || null, config));
    process.exitCode = 0;
  } else {
    notify("TickTick", friendlyError(error), "normal");
    console.error(`tickbar: ${friendlyError(error)}`);
    process.exitCode = 1;
  }
}

async function dispatch(name, args) {
  const config = await loadConfig();
  switch (name) {
    case "status": {
      const { snapshot } = await getSnapshot({
        cacheMinutes: config.cacheMinutes,
      });
      printJson(
        buildWaybarStatus(snapshot.tasks, {
          timeZone: config.timeZone,
          tooltipLimit: config.tooltipLimit,
        }),
      );
      break;
    }
    case "menu": {
      const { snapshot } = await getSnapshot({
        cacheMinutes: config.cacheMinutes,
        force: true,
      });
      let selected = await chooseTask({
        tasks: snapshot.tasks,
        select: walkerSelect,
        config,
      });
      if (!selected) break;
      if (selected.type === "add") {
        await runAdd(config);
      } else if (selected.type === "all") {
        selected = await chooseTask({
          tasks: snapshot.tasks,
          select: walkerSelect,
          all: true,
          config,
        });
        if (selected?.type === "complete") {
          await runComplete(selected.task);
        }
      } else if (selected.type === "complete") {
        await runComplete(selected.task);
      }
      break;
    }
    case "add":
      await runAdd(config, args.join(" ") || undefined);
      break;
    case "auth":
      await backend.authenticate();
      await refresh();
      notify("TickTick", "Connected");
      break;
    case "refresh":
      await refresh();
      break;
    case "open":
      openUrl(config.todayUrl);
      break;
    case "help":
    case "--help":
    case "-h":
      console.log(helpText);
      break;
    case "version":
    case "--version":
    case "-v":
      console.log("ticktick-waybar 0.1.0");
      break;
    default:
      throw new Error(`Unknown command: ${name}\n\n${helpText}`);
  }
}

async function runAdd(config, title) {
  return addTask({
    backend,
    getSnapshot,
    prompt: walkerInput,
    notify,
    refresh,
    config,
    title,
  });
}

async function runComplete(task) {
  return completeSelectedTask({
    task,
    backend,
    notify,
    refresh,
  });
}

async function refresh() {
  await invalidateCache();
  await signalWaybar();
}

function friendlyError(error) {
  const message = String(error?.message || error || "Unknown error").trim();
  if (/auth|log[ -]?in|token|unauthori[sz]ed|401/i.test(message)) {
    return "TickTick is not connected. Run: tickbar auth";
  }
  return message.split(/\r?\n/)[0];
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

const helpText = `Usage: tickbar <command>

Commands:
  status          Print Waybar JSON
  menu            Open the completion menu
  add [title]     Add a task to Inbox
  auth            Connect TickTick through browser OAuth
  refresh         Clear cached tasks and refresh Waybar
  open            Open TickTick Today
  version         Print the version
  help            Show this help`;
