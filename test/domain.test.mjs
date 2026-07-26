import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTaskMenu,
  buildWaybarStatus,
  classifyTask,
  escapePango,
  inferInboxProjectId,
  parseCliJson,
  resolveInbox,
  sortTasks,
  TICKTICK_GLYPH,
} from "../src/domain.mjs";

const now = new Date("2026-07-26T09:00:00.000Z");
const timeZone = "Africa/Nairobi";

test("parseCliJson accepts JSON arrays and NDJSON", () => {
  assert.deepEqual(parseCliJson('[{"id":"1"}]'), [{ id: "1" }]);
  assert.deepEqual(parseCliJson('{"id":"1"}\n{"id":"2"}\n'), [
    { id: "1" },
    { id: "2" },
  ]);
});

test("classifyTask preserves all-day dates and respects timed task timezone", () => {
  assert.equal(
    classifyTask(
      {
        isAllDay: true,
        dueDate: "2026-07-26T00:00:00.000+0000",
      },
      now,
      timeZone,
    ),
    "today",
  );
  assert.equal(
    classifyTask(
      {
        isAllDay: false,
        dueDate: "2026-07-25T22:30:00.000Z",
      },
      now,
      timeZone,
    ),
    "today",
  );
  assert.equal(
    classifyTask(
      {
        isAllDay: true,
        dueDate: "2026-07-25T00:00:00.000+0000",
      },
      now,
      timeZone,
    ),
    "overdue",
  );
});

test("tasks sort by actionable state, date, priority and title", () => {
  const tasks = [
    { title: "Later", dueDate: "2026-07-27", isAllDay: true },
    {
      title: "Normal today",
      dueDate: "2026-07-26",
      isAllDay: true,
      priority: 0,
    },
    {
      title: "Urgent today",
      dueDate: "2026-07-26",
      isAllDay: true,
      priority: 5,
    },
    { title: "Old", dueDate: "2026-07-25", isAllDay: true },
    { title: "No date" },
  ];
  assert.deepEqual(
    sortTasks(tasks, now, timeZone).map((task) => task.title),
    ["Old", "Urgent today", "Normal today", "Later", "No date"],
  );
});

test("Waybar status escapes markup and exposes semantic states", () => {
  const tasks = [
    {
      title: "Ship <release> & notes",
      dueDate: "2026-07-25",
      isAllDay: true,
    },
    {
      title: "Buy milk",
      dueDate: "2026-07-26",
      isAllDay: true,
    },
  ];
  const status = buildWaybarStatus(tasks, { now, timeZone });
  const mark = `<span font_family="Simple Icons" size="90%" rise="512">${TICKTICK_GLYPH}</span>`;
  assert.equal(status.text, `${mark} 2`);
  assert.equal(status.class, "overdue");
  assert.match(status.tooltip, /Ship &lt;release&gt; &amp; notes/);

  const stale = buildWaybarStatus(tasks, { now, timeZone, stale: true });
  assert.equal(stale.class, "stale-overdue");

  const clear = buildWaybarStatus([], { now, timeZone });
  assert.deepEqual(clear, {
    text: mark,
    tooltip: "No tasks due today",
    class: "clear",
  });
});

test("menu includes add, due tasks and all-open fallback", () => {
  const entries = buildTaskMenu(
    [
      {
        id: "1",
        title: "Due",
        dueDate: "2026-07-26",
        isAllDay: true,
      },
      { id: "2", title: "Unscheduled" },
    ],
    { now, timeZone },
  );
  assert.deepEqual(
    entries.map((entry) => entry.type),
    ["add", "complete", "all"],
  );
  assert.equal(entries[1].task.id, "1");
});

test("Inbox resolution supports explicit, kind, name and id signals", () => {
  assert.equal(resolveInbox([{ id: "x", isInbox: true }]).id, "x");
  assert.equal(resolveInbox([{ id: "x", kind: "INBOX" }]).id, "x");
  assert.equal(resolveInbox([{ id: "x", name: "Inbox" }]).id, "x");
  assert.equal(resolveInbox([{ id: "inbox", name: "Boîte" }]).id, "inbox");
});

test("Inbox project ID can be inferred from global task results", () => {
  assert.equal(
    inferInboxProjectId([
      { projectId: "regular-project" },
      { projectId: "inbox-example" },
    ]),
    "inbox-example",
  );
  assert.equal(inferInboxProjectId([{ projectId: "regular-project" }]), null);
});

test("escapePango escapes only markup-significant characters", () => {
  assert.equal(escapePango(`A&B <C> "D"`), `A&amp;B &lt;C&gt; "D"`);
});
