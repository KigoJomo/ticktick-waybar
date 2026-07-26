import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createTask,
  listOpenTasks,
  runTickTick,
} from "../src/backend.mjs";

test("backend preserves CLI errors written to stdout", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tickbar-backend-"));
  const executable = path.join(directory, "fake-ticktick");
  const previous = process.env.TICKBAR_TICKTICK_BIN;
  try {
    await fs.writeFile(
      executable,
      "#!/bin/sh\necho 'No access token found. Run ticktick auth login.'\nexit 1\n",
      { mode: 0o700 },
    );
    process.env.TICKBAR_TICKTICK_BIN = executable;
    await assert.rejects(
      runTickTick(["project", "list", "--json"]),
      /No access token found/,
    );
  } finally {
    if (previous === undefined) delete process.env.TICKBAR_TICKTICK_BIN;
    else process.env.TICKBAR_TICKTICK_BIN = previous;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("backend fetches every open task while excluding Notes", async () => {
  await withFakeTickTick(
    `#!/bin/sh
printf '%s\n' '[{"id":"task","kind":"TEXT","status":0},{"id":"note","kind":"NOTE","status":0}]'
`,
    async () => {
      assert.deepEqual(await listOpenTasks(), [
        { id: "task", kind: "TEXT", status: 0 },
      ]);
    },
  );
});

test("backend passes the discovered Inbox project to task creation", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tickbar-args-"));
  const argsFile = path.join(directory, "args");
  const previousArgsFile = process.env.ARGS_FILE;
  process.env.ARGS_FILE = argsFile;
  try {
    await withFakeTickTick(
      `#!/bin/sh
printf '%s\n' "$@" > "$ARGS_FILE"
printf '%s\n' '{"id":"created","projectId":"inbox-1","title":"Buy milk"}'
`,
      async () => {
        const created = await createTask("Buy milk", "inbox-1", {
          content: "Oat milk",
          allDay: true,
          dueDate: "2026-07-27T00:00:00.000Z",
          timeZone: "Africa/Nairobi",
          priority: 5,
          tags: ["errands", "home"],
          items: ["Compare prices"],
        });
        assert.equal(created.projectId, "inbox-1");
        const args = (await fs.readFile(argsFile, "utf8")).trim().split("\n");
        assert.equal(args.includes("--project"), true);
        assert.equal(args[args.indexOf("--project") + 1], "inbox-1");
        assert.equal(args[args.indexOf("--content") + 1], "Oat milk");
        assert.equal(args.includes("--all-day"), true);
        assert.equal(
          args[args.indexOf("--due-date") + 1],
          "2026-07-27T00:00:00.000Z",
        );
        assert.equal(args[args.indexOf("--priority") + 1], "5");
        assert.equal(args[args.indexOf("--tags") + 1], "errands,home");
        assert.deepEqual(JSON.parse(args[args.indexOf("--items") + 1]), [
          { title: "Compare prices", status: 0 },
        ]);
      },
    );
  } finally {
    if (previousArgsFile === undefined) delete process.env.ARGS_FILE;
    else process.env.ARGS_FILE = previousArgsFile;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

async function withFakeTickTick(contents, callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tickbar-backend-"));
  const executable = path.join(directory, "fake-ticktick");
  const previous = process.env.TICKBAR_TICKTICK_BIN;
  try {
    await fs.writeFile(executable, contents, { mode: 0o700 });
    process.env.TICKBAR_TICKTICK_BIN = executable;
    await callback();
  } finally {
    if (previous === undefined) delete process.env.TICKBAR_TICKTICK_BIN;
    else process.env.TICKBAR_TICKTICK_BIN = previous;
    await fs.rm(directory, { recursive: true, force: true });
  }
}
