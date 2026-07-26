import fs from "node:fs/promises";
import { systemTimeZone } from "./domain.mjs";
import { configFile } from "./paths.mjs";

const defaults = {
  cacheMinutes: 5,
  defaultProjectId: null,
  timeZone: systemTimeZone(),
  tooltipLimit: 8,
  todayUrl: "https://ticktick.com/webapp/#q/all/today",
};

export async function loadConfig() {
  try {
    const configured = JSON.parse(await fs.readFile(configFile(), "utf8"));
    return {
      ...defaults,
      ...configured,
      cacheMinutes: positiveNumber(configured.cacheMinutes, defaults.cacheMinutes),
      tooltipLimit: positiveNumber(configured.tooltipLimit, defaults.tooltipLimit),
    };
  } catch (error) {
    if (error.code === "ENOENT") return { ...defaults };
    throw new Error(`Invalid TickTick Waybar config: ${error.message}`);
  }
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
