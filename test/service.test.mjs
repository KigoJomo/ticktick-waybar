import test from "node:test";
import assert from "node:assert/strict";
import {
  addTask,
  completeSelectedTask,
} from "../src/service.mjs";

const config = { cacheMinutes: 5, timeZone: "Africa/Nairobi" };

test("addTask cancels blank input without touching TickTick", async () => {
  let called = false;
  const result = await addTask({
    backend: {
      createTask: async () => {
        called = true;
      },
    },
    getSnapshot: async () => {
      called = true;
    },
    prompt: async () => "   ",
    notify: () => {
      called = true;
    },
    refresh: async () => {
      called = true;
    },
    config,
  });
  assert.deepEqual(result, { cancelled: true });
  assert.equal(called, false);
});

test("addTask resolves the discovered Inbox, normalises the title and refreshes", async () => {
  const events = [];
  const result = await addTask({
    backend: {
      createTask: async (title, projectId) => {
        events.push(["create", title, projectId]);
        return { id: "task-1", title };
      },
    },
    getSnapshot: async () => ({
      snapshot: {
        projects: [{ id: "inbox-id", name: "Inbox", isInbox: true }],
        tasks: [],
      },
    }),
    prompt: async () => "  Buy   milk\n ",
    notify: (summary, body) => events.push(["notify", summary, body]),
    refresh: async () => events.push(["refresh"]),
    config,
  });
  assert.equal(result.title, "Buy milk");
  assert.deepEqual(events, [
    ["create", "Buy milk", "inbox-id"],
    ["refresh"],
    ["notify", "TickTick", "Added: Buy milk"],
  ]);
});

test("completeSelectedTask completes, refreshes and notifies", async () => {
  const events = [];
  const task = { id: "task-1", projectId: "project-1", title: "Ship it" };
  await completeSelectedTask({
    task,
    backend: {
      completeTask: async (selected) => events.push(["complete", selected.id]),
    },
    notify: (summary, body) => events.push(["notify", summary, body]),
    refresh: async () => events.push(["refresh"]),
  });
  assert.deepEqual(events, [
    ["complete", "task-1"],
    ["refresh"],
    ["notify", "TickTick", "Completed: Ship it"],
  ]);
});
