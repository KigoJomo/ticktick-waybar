#!/usr/bin/env node
import {
  completeTask,
  deleteTask,
  fetchSnapshot,
  runTickTick,
} from "../src/backend.mjs";
import {
  dateKey,
  dueTasks,
  parseCliJson,
  resolveInbox,
} from "../src/domain.mjs";
import { loadConfig } from "../src/config.mjs";

const config = await loadConfig();
const title = `[ticktick-waybar e2e ${Date.now()}]`;
const today = dateKey(new Date(), config.timeZone);
const timestamp = `${today}T00:00:00+0000`;
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

  const { stdout } = await runTickTick([
    "task",
    "create",
    "--title",
    title,
    "--project",
    inbox.id,
    "--all-day",
    "--start-date",
    timestamp,
    "--due-date",
    timestamp,
    "--time-zone",
    config.timeZone,
    "--json",
  ]);
  created = parseCliJson(stdout);
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
  if (!afterCreate.tasks.some((task) => task.id === created.id)) {
    throw new Error("Created task was not returned by the open-task filter");
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
    })}\n`,
  );
} finally {
  if (created?.id && created?.projectId) {
    await deleteTask(created).catch(() => {});
  }
}
