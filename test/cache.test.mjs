import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  invalidateCache,
  isFresh,
  readCache,
  writeCache,
} from "../src/cache.mjs";

test("cache writes atomically, expires and invalidates", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tickbar-cache-"));
  const previous = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = directory;
  try {
    await writeCache({ projects: [], tasks: [{ id: "1" }] }, 1_000);
    const cached = await readCache();
    assert.equal(cached.savedAt, 1_000);
    assert.equal(cached.tasks[0].id, "1");
    assert.equal(isFresh(cached, 500, 1_499), true);
    assert.equal(isFresh(cached, 500, 1_500), false);
    await invalidateCache();
    assert.equal(await readCache(), null);
  } finally {
    if (previous === undefined) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = previous;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
