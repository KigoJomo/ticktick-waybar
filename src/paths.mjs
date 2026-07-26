import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function xdgPath(kind, suffix = "") {
  const home = os.homedir();
  const roots = {
    cache: process.env.XDG_CACHE_HOME || path.join(home, ".cache"),
    config: process.env.XDG_CONFIG_HOME || path.join(home, ".config"),
    state:
      process.env.XDG_STATE_HOME || path.join(home, ".local", "state"),
  };
  return path.join(roots[kind], suffix);
}

export const cacheDirectory = () => xdgPath("cache", "ticktick-waybar");
export const cacheFile = () => path.join(cacheDirectory(), "tasks.json");
export const configFile = () =>
  xdgPath("config", path.join("ticktick-waybar", "config.json"));
export const installStateFile = () =>
  xdgPath("state", path.join("ticktick-waybar", "install.json"));
