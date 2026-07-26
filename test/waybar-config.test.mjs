import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "jsonc-parser";
import {
  HOST_GROUP,
  STYLE_END,
  STYLE_START,
  patchWaybarConfig,
  patchWaybarStyle,
  unpatchWaybarConfig,
  unpatchWaybarStyle,
} from "../src/waybar-config.mjs";

const config = `{
  // Keep this comment.
  "modules-left": ["hyprland/workspaces"],
  "modules-center": [
    "custom/weather",
    "clock",
    "mpris",
  ],
  "modules-right": ["network"],
  "clock": { "format": "{:%H:%M}" },
}`;

test("config patch is comment-safe, correctly placed and idempotent", () => {
  const options = {
    commandPath: "/home/test/.local/bin/tickbar",
    position: "center",
  };
  const once = patchWaybarConfig(config, options);
  const twice = patchWaybarConfig(once, options);
  const parsed = parse(twice);
  assert.match(twice, /Keep this comment/);
  assert.deepEqual(parsed["modules-center"], [
    HOST_GROUP,
    "custom/ticktick",
  ]);
  assert.deepEqual(parsed[HOST_GROUP].modules, [
    "custom/weather",
    "clock",
    "mpris",
  ]);
  assert.equal(
    parsed["custom/ticktick"].exec,
    "/home/test/.local/bin/tickbar status",
  );
  assert.equal(
    parsed["modules-center"].filter((item) => item === "custom/ticktick").length,
    1,
  );
});

test("config patch supports alternate module positions", () => {
  const patched = patchWaybarConfig(config, {
    commandPath: "/tmp/tickbar",
    position: "left",
  });
  assert.deepEqual(parse(patched)["modules-left"], [
    "hyprland/workspaces",
    "custom/ticktick",
  ]);
});

test("config unpatch removes only TickTick-owned config", () => {
  const patched = patchWaybarConfig(config, {
    commandPath: "/tmp/tickbar",
    position: "center",
  });
  const removed = unpatchWaybarConfig(patched);
  const parsed = parse(removed);
  assert.equal(parsed["custom/ticktick"], undefined);
  assert.equal(parsed[HOST_GROUP], undefined);
  assert.deepEqual(parsed["modules-center"], [
    "custom/weather",
    "clock",
    "mpris",
  ]);
  assert.equal(parsed.clock.format, "{:%H:%M}");
  assert.match(removed, /Keep this comment/);
});

test("style patch is marked, idempotent and reversible", () => {
  const original = "@import \"theme.css\";\n\n#clock { margin: 2px; }\n";
  const once = patchWaybarStyle(original);
  const twice = patchWaybarStyle(once);
  assert.equal(twice.indexOf(STYLE_START), twice.lastIndexOf(STYLE_START));
  assert.equal(twice.indexOf(STYLE_END), twice.lastIndexOf(STYLE_END));
  assert.match(twice, /#ticktick-waybar-host/);
  assert.doesNotMatch(twice, /text-decoration/);
  assert.equal(unpatchWaybarStyle(twice).trim(), original.trim());
});

test("alternate positions do not restyle the centre container", () => {
  const patched = patchWaybarStyle("@import \"theme.css\";\n", "left");
  assert.doesNotMatch(patched, /\.modules-center/);
  assert.doesNotMatch(patched, /#ticktick-waybar-host/);
  assert.match(patched, /#custom-ticktick/);
});
