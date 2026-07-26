import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeCache } from "../src/cache.mjs";
import { getSnapshot } from "../src/data.mjs";

test("interactive reads prefer an expired cache over blocking on the API", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tickbar-data-"));
  const previous = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = directory;
  let fetched = false;
  try {
    await writeCache({ projects: [], tasks: [{ id: "cached" }] }, 1);
    const result = await getSnapshot({
      cacheMinutes: 1,
      preferCache: true,
      fetcher: async () => {
        fetched = true;
        return { projects: [], tasks: [{ id: "network" }] };
      },
    });
    assert.equal(result.snapshot.tasks[0].id, "cached");
    assert.equal(fetched, false);
  } finally {
    if (previous === undefined) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = previous;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
