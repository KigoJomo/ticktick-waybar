import test from "node:test";
import assert from "node:assert/strict";
import {
  addDetailedTask,
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

test("detailed task editor creates only after selected fields are configured", async () => {
  const events = [];
  const prompts = [
    "Ship release",
    "Include migration notes",
    "2026-07-27 09:30",
    "release, docs",
    "Write notes, Tag version",
  ];
  const editorActions = [
    "content",
    "due",
    "priority",
    "project",
    "tags",
    "items",
    "create",
  ];

  const result = await addDetailedTask({
    backend: {
      createTask: async (title, projectId, options) => {
        events.push(["create", title, projectId, options]);
        return { id: "task-detailed", title, projectId, ...options };
      },
    },
    getSnapshot: async (options) => {
      events.push(["snapshot", options.preferCache]);
      return {
        snapshot: {
          projects: [
            { id: "inbox-id", name: "Inbox", isInbox: true },
            { id: "work-id", name: "Work" },
            { id: "notes-id", name: "Notes", kind: "NOTE" },
          ],
          tasks: [],
        },
      };
    },
    prompt: async () => prompts.shift(),
    select: async (entries, placeholder) => {
      if (placeholder === "New TickTick task") {
        const type = editorActions.shift();
        return entries.find((entry) => entry.type === type);
      }
      if (placeholder === "Due date") {
        return entries.find((entry) => entry.type === "custom");
      }
      if (placeholder === "Priority") {
        return entries.find((entry) => entry.value === 5);
      }
      if (placeholder === "List") {
        assert.equal(
          entries.some((entry) => entry.project.id === "notes-id"),
          false,
        );
        return entries.find((entry) => entry.project.id === "work-id");
      }
      throw new Error(`Unexpected selector: ${placeholder}`);
    },
    notify: (summary, body) => events.push(["notify", summary, body]),
    refresh: async () => events.push(["refresh"]),
    config,
    now: new Date("2026-07-26T09:00:00.000Z"),
  });

  assert.equal(result.created.id, "task-detailed");
  assert.deepEqual(events, [
    ["snapshot", true],
    [
      "create",
      "Ship release",
      "work-id",
      {
        content: "Include migration notes",
        allDay: false,
        dueDate: "2026-07-27T06:30:00.000Z",
        timeZone: "Africa/Nairobi",
        priority: 5,
        tags: ["release", "docs"],
        items: ["Write notes", "Tag version"],
      },
    ],
    ["refresh"],
    ["notify", "TickTick", "Added: Ship release"],
  ]);
});

test("detailed task editor cancels without creating a task", async () => {
  let created = false;
  const result = await addDetailedTask({
    backend: {
      createTask: async () => {
        created = true;
      },
    },
    getSnapshot: async () => ({
      snapshot: {
        projects: [{ id: "inbox-id", name: "Inbox", isInbox: true }],
        tasks: [],
      },
    }),
    prompt: async () => "Draft task",
    select: async () => null,
    notify: () => {},
    refresh: async () => {},
    config,
  });
  assert.deepEqual(result, { cancelled: true });
  assert.equal(created, false);
});
