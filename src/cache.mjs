import fs from "node:fs/promises";
import path from "node:path";
import { cacheDirectory, cacheFile } from "./paths.mjs";

export async function readCache() {
  try {
    return JSON.parse(await fs.readFile(cacheFile(), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function isFresh(cache, maxAgeMs, now = Date.now()) {
  return Boolean(
    cache &&
      Number.isFinite(cache.savedAt) &&
      now - cache.savedAt >= 0 &&
      now - cache.savedAt < maxAgeMs,
  );
}

export async function writeCache(snapshot, now = Date.now()) {
  const directory = cacheDirectory();
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = cacheFile();
  const temporary = path.join(
    directory,
    `.tasks.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  await fs.writeFile(
    temporary,
    `${JSON.stringify({ ...snapshot, savedAt: now })}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await fs.rename(temporary, destination);
}

export async function invalidateCache() {
  try {
    await fs.unlink(cacheFile());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export async function expireCache() {
  const cached = await readCache();
  if (!cached) return;
  await writeCache(cached, 0);
}
