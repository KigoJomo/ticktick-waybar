import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parse } from "jsonc-parser";
import { HOST_GROUP } from "../src/waybar-config.mjs";

const execFileAsync = promisify(execFile);
const script = path.resolve("scripts/configure-waybar.mjs");
const originalConfig = `{
  // Preserve me.
  "modules-left": [],
  "modules-center": ["clock", "mpris"],
  "modules-right": [],
}`;
const originalStyle = `@import "theme.css";\n\n#clock { margin: 2px; }\n`;

test("installer is idempotent, backed up and reversible", async () => {
  const fixture = await createFixture();
  try {
    const args = [
      script,
      "install",
      fixture.configPath,
      fixture.stylePath,
      "/home/test/.local/bin/tickbar",
      "center",
    ];
    await execFileAsync(process.execPath, args, { env: fixture.env });
    await execFileAsync(process.execPath, args, { env: fixture.env });

    const installed = parse(await fs.readFile(fixture.configPath, "utf8"));
    assert.deepEqual(installed["modules-center"], [
      HOST_GROUP,
      "custom/ticktick",
    ]);
    assert.deepEqual(installed[HOST_GROUP].modules, ["clock", "mpris"]);
    assert.equal(
      installed["modules-center"].filter(
        (module) => module === "custom/ticktick",
      ).length,
      1,
    );

    const backups = await fs.readdir(
      path.join(fixture.directory, ".ticktick-waybar-backups"),
    );
    assert.equal(backups.length, 2);

    await execFileAsync(
      process.execPath,
      [script, "uninstall", fixture.configPath, fixture.stylePath],
      { env: fixture.env },
    );
    assert.equal(
      (await fs.readFile(fixture.configPath, "utf8")).includes("ticktick"),
      false,
    );
    assert.equal(
      (await fs.readFile(fixture.stylePath, "utf8")).includes("ticktick"),
      false,
    );
  } finally {
    await fs.rm(fixture.directory, { recursive: true, force: true });
  }
});

test("installer leaves Waybar untouched when state storage is unavailable", async () => {
  const fixture = await createFixture();
  try {
    const blockedState = path.join(fixture.directory, "blocked-state");
    await fs.writeFile(blockedState, "not a directory");
    await assert.rejects(
      execFileAsync(
        process.execPath,
        [
          script,
          "install",
          fixture.configPath,
          fixture.stylePath,
          "/tmp/tickbar",
          "center",
        ],
        {
          env: { ...fixture.env, XDG_STATE_HOME: blockedState },
        },
      ),
    );
    assert.equal(await fs.readFile(fixture.configPath, "utf8"), originalConfig);
    assert.equal(await fs.readFile(fixture.stylePath, "utf8"), originalStyle);
  } finally {
    await fs.rm(fixture.directory, { recursive: true, force: true });
  }
});

async function createFixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tickbar-install-"));
  const configPath = path.join(directory, "config.jsonc");
  const stylePath = path.join(directory, "style.css");
  await fs.writeFile(configPath, originalConfig);
  await fs.writeFile(stylePath, originalStyle);
  return {
    directory,
    configPath,
    stylePath,
    env: {
      ...process.env,
      XDG_STATE_HOME: path.join(directory, "state"),
    },
  };
}
