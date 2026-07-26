import fs from "node:fs/promises";
import { fetchSnapshot } from "./backend.mjs";
import { isFresh, readCache, writeCache } from "./cache.mjs";

export async function getSnapshot({
  cacheMinutes = 5,
  force = false,
  fetcher = fetchSnapshot,
} = {}) {
  const cached = await readCache();
  if (!force && isFresh(cached, cacheMinutes * 60_000)) {
    return { snapshot: cached, cached, stale: false };
  }

  if (process.env.TICKBAR_FIXTURE) {
    const fixture = JSON.parse(
      await fs.readFile(process.env.TICKBAR_FIXTURE, "utf8"),
    );
    return { snapshot: fixture, cached, stale: false };
  }

  try {
    const snapshot = await fetcher();
    await writeCache(snapshot);
    return { snapshot, cached, stale: false };
  } catch (error) {
    error.cached = cached;
    throw error;
  }
}
