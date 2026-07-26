#!/usr/bin/env node
import {
  completeTask,
  createTask,
  deleteTask,
  fetchSnapshot,
} from "../src/backend.mjs";
import {
  dateKey,
  dueTasks,
  resolveInbox,
} from "../src/domain.mjs";
import { loadConfig } from "../src/config.mjs";

const config = await loadConfig();
const title = `[ticktick-waybar e2e ${Date.now()}]`;
const today = dateKey(new Date(), config.timeZone);
const timestamp = `${today}T00:00:00.000Z`;
let created = null;

try {
  const before = await fetchSnapshot();
  const beforeCount = dueTasks(
    before.tasks,
    new Date(),
    config.timeZone,
  ).length;
  const inbox = resolveInbox(before.projects);
  if (!inbox) throw new Error("Inbox could not be discovered for E2E testing");

  created = await createTask(title, inbox.id, {
    content: "Disposable detailed-task verification",
    allDay: true,
    dueDate: timestamp,
    timeZone: config.timeZone,
    priority: 1,
    tags: ["tickbar-e2e"],
    items: ["Disposable subtask"],
  });
  if (Array.isArray(created)) [created] = created;
  if (!created?.id || !created?.projectId) {
    throw new Error("Created task did not return an ID and project ID");
  }
  if (!String(created.projectId).toLowerCase().startsWith("inbox")) {
    throw new Error(`Projectless task was not routed to Inbox: ${created.projectId}`);
  }

  const afterCreate = await fetchSnapshot();
  const afterCount = dueTasks(
    afterCreate.tasks,
    new Date(),
    config.timeZone,
  ).length;
  const displayed = afterCreate.tasks.find((task) => task.id === created.id);
  if (!displayed) {
    throw new Error("Created task was not returned by the open-task filter");
  }
  if (displayed.content !== "Disposable detailed-task verification") {
    throw new Error("Created task description was not preserved");
  }
  if (Number(displayed.priority) !== 1) {
    throw new Error("Created task priority was not preserved");
  }
  if (!displayed.tags?.includes("tickbar-e2e")) {
    throw new Error("Created task tags were not preserved");
  }
  if (!displayed.items?.some((item) => item.title === "Disposable subtask")) {
    throw new Error("Created task subtasks were not preserved");
  }
  if (afterCount !== beforeCount + 1) {
    throw new Error(
      `Due count did not increment: expected ${beforeCount + 1}, got ${afterCount}`,
    );
  }

  await completeTask(created);
  const afterComplete = await fetchSnapshot();
  if (afterComplete.tasks.some((task) => task.id === created.id)) {
    throw new Error("Completed task remained in the open-task filter");
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      inboxProjectId: created.projectId,
      dueCountBefore: beforeCount,
      dueCountAfterCreate: afterCount,
      completed: true,
      detailedFields: true,
    })}\n`,
  );
} finally {
  if (created?.id && created?.projectId) {
    await deleteTask(created).catch(() => {});
  }
}
