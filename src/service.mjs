import {
  buildAllTaskMenu,
  buildTaskMenu,
  resolveInbox,
  singleLine,
} from "./domain.mjs";

export async function addTask({
  backend,
  getSnapshot,
  prompt,
  notify,
  refresh,
  config,
  title,
}) {
  const entered = title ?? (await prompt("Add to Inbox"));
  const cleanTitle = singleLine(entered);
  if (!cleanTitle) return { cancelled: true };

  const { snapshot } = await getSnapshot({
    cacheMinutes: config.cacheMinutes,
    force: false,
  });
  const projectId =
    config.defaultProjectId || resolveInbox(snapshot.projects)?.id || null;
  if (!projectId) {
    throw new Error(
      "Inbox could not be discovered. Set defaultProjectId in ~/.config/ticktick-waybar/config.json",
    );
  }
  const created = await backend.createTask(cleanTitle, projectId);
  await refresh();
  notify("TickTick", `Added: ${cleanTitle}`);
  return { created, title: cleanTitle };
}

export async function completeSelectedTask({
  task,
  backend,
  notify,
  refresh,
}) {
  await backend.completeTask(task);
  await refresh();
  notify("TickTick", `Completed: ${singleLine(task.title)}`);
  return task;
}

export async function chooseTask({
  tasks,
  select,
  all = false,
  config,
  now = new Date(),
}) {
  const entries = all
    ? buildAllTaskMenu(tasks, { now, timeZone: config.timeZone })
    : buildTaskMenu(tasks, { now, timeZone: config.timeZone });
  return select(entries, all ? "All open tasks" : "TickTick");
}
