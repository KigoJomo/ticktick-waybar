#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  backupWaybarFiles,
  patchWaybarConfig,
  patchWaybarStyle,
  unpatchWaybarConfig,
  unpatchWaybarStyle,
  writeAtomic,
} from "../src/waybar-config.mjs";
import { installStateFile } from "../src/paths.mjs";

const [operation, configPath, stylePath, commandPath, position = "center"] =
  process.argv.slice(2);

if (!["install", "uninstall"].includes(operation) || !configPath || !stylePath) {
  console.error(
    "Usage: configure-waybar.mjs <install|uninstall> <config> <style> [command] [position]",
  );
  process.exit(2);
}

const [configText, styleText] = await Promise.all([
  fs.readFile(configPath, "utf8"),
  fs.readFile(stylePath, "utf8"),
]);
const statePath = installStateFile();
if (operation === "install") {
  await fs.mkdir(path.dirname(statePath), { recursive: true, mode: 0o700 });
}
const backupDirectory = await backupWaybarFiles(
  configPath,
  stylePath,
  operation,
);

try {
  if (operation === "install") {
    if (!commandPath) throw new Error("The installed tickbar command is required");
    const nextConfig = patchWaybarConfig(configText, { commandPath, position });
    const nextStyle = patchWaybarStyle(styleText, position);
    await writeAtomic(configPath, nextConfig);
    await writeAtomic(stylePath, nextStyle);
    await writeAtomic(
      statePath,
      `${JSON.stringify(
        {
          configPath,
          stylePath,
          commandPath,
          position,
          backupDirectory,
          installedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );
  } else {
    await writeAtomic(configPath, unpatchWaybarConfig(configText));
    await writeAtomic(stylePath, unpatchWaybarStyle(styleText));
  }
} catch (error) {
  await Promise.allSettled([
    writeAtomic(configPath, configText),
    writeAtomic(stylePath, styleText),
  ]);
  throw error;
}

process.stdout.write(
  `${JSON.stringify({ operation, configPath, stylePath, backupDirectory })}\n`,
);
