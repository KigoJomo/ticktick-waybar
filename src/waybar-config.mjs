import fs from "node:fs/promises";
import path from "node:path";
import {
  applyEdits,
  modify,
  parse,
  parseTree,
  printParseErrorCode,
} from "jsonc-parser";

export const STYLE_START = "/* ticktick-waybar:start */";
export const STYLE_END = "/* ticktick-waybar:end */";
export const HOST_GROUP = "group/ticktick-waybar-host";

export function waybarStyleBlock(position = "center") {
  const placement =
    position === "center"
      ? `.modules-center {
  background: transparent;
  border: none;
  padding: 0;
}

#ticktick-waybar-host,
#custom-ticktick {
  background: alpha(@foreground, 0.06);
  border: 1px solid alpha(@foreground, 0.14);
  border-radius: 12px;
}

#ticktick-waybar-host {
  padding: 0 6px;
}

#custom-ticktick {
  min-width: 14px;
  margin-left: 6px;
  padding: 0 7px;
}`
      : `#custom-ticktick {
  min-width: 12px;
  margin: 0 6px;
}`;

  return `${STYLE_START}
${placement}

#custom-ticktick:hover {
  opacity: 0.82;
}

#custom-ticktick:active {
  opacity: 0.68;
}

#custom-ticktick.overdue,
#custom-ticktick.stale-overdue {
  font-weight: 700;
  background: alpha(@foreground, 0.11);
  border-color: alpha(@foreground, 0.28);
}

#custom-ticktick.stale,
#custom-ticktick.stale-overdue,
#custom-ticktick.locked {
  opacity: 0.58;
}

#custom-ticktick.error {
  font-weight: 700;
}
${STYLE_END}`;
}

export function assertJsonc(text, fileName = "Waybar config") {
  const errors = [];
  parseTree(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length) {
    const detail = errors
      .map((error) => `${printParseErrorCode(error.error)} at ${error.offset}`)
      .join(", ");
    throw new Error(`${fileName} is invalid JSONC: ${detail}`);
  }
}

export function patchWaybarConfig(
  text,
  { commandPath, position = "center" },
) {
  assertJsonc(text);
  const parsed = parse(text, [], {
    allowTrailingComma: true,
    disallowComments: false,
  });
  const modulesKey = `modules-${position}`;
  const modules = parsed[modulesKey];
  if (!Array.isArray(modules)) {
    throw new Error(`Waybar config has no ${modulesKey} array`);
  }

  let updated = text;
  if (position === "center") {
    const existingGroup = parsed[HOST_GROUP];
    const hostModules = modules.includes(HOST_GROUP)
      ? existingGroup?.modules
      : modules.filter((module) => module !== "custom/ticktick");
    if (!Array.isArray(hostModules)) {
      throw new Error(`${HOST_GROUP} exists but has no modules array`);
    }
    updated = applyEdits(
      updated,
      modify(
        updated,
        [HOST_GROUP],
        { orientation: "inherit", modules: hostModules },
        { formattingOptions: { insertSpaces: true, tabSize: 2 } },
      ),
    );
    updated = applyEdits(
      updated,
      modify(updated, [modulesKey], [HOST_GROUP, "custom/ticktick"], {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    );
  } else if (!modules.includes("custom/ticktick")) {
    const clockIndex = position === "center" ? modules.indexOf("clock") : -1;
    const insertionIndex = clockIndex >= 0 ? clockIndex + 1 : modules.length;
    updated = applyEdits(
      updated,
      modify(updated, [modulesKey, insertionIndex], "custom/ticktick", {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
        isArrayInsertion: true,
      }),
    );
  }

  const moduleDefinition = {
    exec: `${commandPath} status`,
    "return-type": "json",
    interval: 300,
    signal: 12,
    "exec-on-event": true,
    "on-click": `${commandPath} menu`,
    "on-click-right": `${commandPath} add`,
    "on-click-middle": `${commandPath} open`,
    tooltip: true,
  };
  updated = applyEdits(
    updated,
    modify(updated, ["custom/ticktick"], moduleDefinition, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    }),
  );
  assertJsonc(updated);
  return updated;
}

export function unpatchWaybarConfig(text) {
  assertJsonc(text);
  let updated = text;
  const parsed = parse(updated, [], {
    allowTrailingComma: true,
    disallowComments: false,
  });

  const centreModules = parsed["modules-center"];
  const hostModules = parsed[HOST_GROUP]?.modules;
  if (
    Array.isArray(centreModules) &&
    centreModules.includes(HOST_GROUP) &&
    Array.isArray(hostModules)
  ) {
    const restored = centreModules.flatMap((module) => {
      if (module === HOST_GROUP) return hostModules;
      if (module === "custom/ticktick") return [];
      return [module];
    });
    updated = applyEdits(
      updated,
      modify(updated, ["modules-center"], restored, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    );
  }

  const withoutHostGroup = parse(updated, [], {
    allowTrailingComma: true,
    disallowComments: false,
  });
  for (const modulesKey of [
    "modules-left",
    "modules-center",
    "modules-right",
  ]) {
    const modules = withoutHostGroup[modulesKey];
    if (!Array.isArray(modules)) continue;
    for (let index = modules.length - 1; index >= 0; index -= 1) {
      if (modules[index] !== "custom/ticktick") continue;
      updated = applyEdits(
        updated,
        modify(updated, [modulesKey, index], undefined, {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      );
    }
  }

  const withModule = parse(updated, [], {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (withModule["custom/ticktick"] !== undefined) {
    updated = applyEdits(
      updated,
      modify(updated, ["custom/ticktick"], undefined, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    );
  }
  if (withModule[HOST_GROUP] !== undefined) {
    updated = applyEdits(
      updated,
      modify(updated, [HOST_GROUP], undefined, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    );
  }
  assertJsonc(updated);
  return updated;
}

export function patchWaybarStyle(text, position = "center") {
  const cleaned = unpatchWaybarStyle(text).trimEnd();
  return `${cleaned}\n\n${waybarStyleBlock(position)}\n`;
}

export function unpatchWaybarStyle(text) {
  const start = text.indexOf(STYLE_START);
  if (start < 0) return text;
  const end = text.indexOf(STYLE_END, start);
  if (end < 0) {
    throw new Error("TickTick Waybar CSS marker is incomplete");
  }
  return `${text.slice(0, start).trimEnd()}\n${text
    .slice(end + STYLE_END.length)
    .trimStart()}`;
}

export async function backupWaybarFiles(configPath, stylePath, operation) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const directory = path.join(
    path.dirname(configPath),
    ".ticktick-waybar-backups",
    `${timestamp}-${operation}`,
  );
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.copyFile(configPath, path.join(directory, path.basename(configPath)));
  await fs.copyFile(stylePath, path.join(directory, path.basename(stylePath)));
  return directory;
}

export async function writeAtomic(filePath, contents) {
  const temporary = `${filePath}.ticktick-waybar.${process.pid}.tmp`;
  let mode = 0o600;
  try {
    mode = (await fs.stat(filePath)).mode & 0o777;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.writeFile(temporary, contents, { encoding: "utf8", mode });
  await fs.chmod(temporary, mode);
  await fs.rename(temporary, filePath);
}
