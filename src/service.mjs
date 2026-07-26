import {
  buildAllTaskMenu,
  buildTaskMenu,
  parseDueInput,
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

export async function addDetailedTask({
  backend,
  getSnapshot,
  prompt,
  select,
  notify,
  refresh,
  config,
  now = new Date(),
}) {
  const title = singleLine(await prompt("Task title"));
  if (!title) return { cancelled: true };

  const { snapshot } = await getSnapshot({
    cacheMinutes: config.cacheMinutes,
    preferCache: true,
  });
  const projects = writableProjects(snapshot.projects);
  const inbox = resolveInbox(projects);
  const defaultProject =
    projects.find((project) => project.id === config.defaultProjectId) ||
    inbox ||
    projects[0] ||
    null;
  if (!defaultProject) {
    throw new Error("No writable TickTick list is available");
  }

  const draft = {
    title,
    content: "",
    due: null,
    priority: 0,
    projectId: defaultProject.id,
    tags: [],
    items: [],
  };

  while (true) {
    const action = await select(
      detailedTaskEntries(draft, projects),
      "New TickTick task",
    );
    if (!action || action.type === "cancel") return { cancelled: true };

    if (action.type === "create") {
      const created = await backend.createTask(draft.title, draft.projectId, {
        content: draft.content,
        allDay: draft.due?.allDay,
        dueDate: draft.due?.dueDate,
        timeZone: draft.due?.timeZone,
        priority: draft.priority,
        tags: draft.tags,
        items: draft.items,
      });
      await refresh();
      notify("TickTick", `Added: ${draft.title}`);
      return { created, draft };
    }

    if (action.type === "title") {
      const value = await prompt("Task title");
      if (value === null) continue;
      const updated = singleLine(value);
      if (updated) draft.title = updated;
    } else if (action.type === "content") {
      const value = await prompt("Description (blank clears)");
      if (value !== null) draft.content = singleLine(value);
    } else if (action.type === "due") {
      await editDueDate({ draft, select, prompt, notify, config, now });
    } else if (action.type === "priority") {
      const priority = await select(priorityEntries(), "Priority");
      if (priority) draft.priority = priority.value;
    } else if (action.type === "project") {
      const project = await select(
        projects.map((item) => ({
          type: "project",
          project: item,
          label: item.name,
        })),
        "List",
      );
      if (project) draft.projectId = project.project.id;
    } else if (action.type === "tags") {
      const value = await prompt("Tags, comma-separated (blank clears)");
      if (value !== null) draft.tags = commaSeparated(value);
    } else if (action.type === "items") {
      const value = await prompt("Subtasks, comma-separated (blank clears)");
      if (value !== null) draft.items = commaSeparated(value);
    }
  }
}

export function detailedTaskEntries(draft, projects) {
  const project =
    projects.find((item) => item.id === draft.projectId)?.name || "Unknown";
  const priorities = new Map(
    priorityEntries().map((item) => [item.value, item.name]),
  );
  return [
    { type: "create", label: "✓  Create task" },
    { type: "title", label: `Title · ${draft.title}` },
    {
      type: "content",
      label: `Description · ${draft.content || "Not set"}`,
    },
    { type: "due", label: `Due · ${draft.due?.label || "No date"}` },
    {
      type: "priority",
      label: `Priority · ${priorities.get(draft.priority) || "None"}`,
    },
    { type: "project", label: `List · ${project}` },
    {
      type: "tags",
      label: `Tags · ${draft.tags.length ? draft.tags.join(", ") : "None"}`,
    },
    {
      type: "items",
      label: `Subtasks · ${draft.items.length ? draft.items.join(", ") : "None"}`,
    },
  ];
}

async function editDueDate({ draft, select, prompt, notify, config, now }) {
  const action = await select(
    [
      { type: "clear", label: "No date" },
      { type: "today", label: "Today · all day" },
      { type: "tomorrow", label: "Tomorrow · all day" },
      { type: "custom", label: "Custom date or time…" },
    ],
    "Due date",
  );
  if (!action) return;
  if (action.type === "clear") {
    draft.due = null;
    return;
  }

  let value = action.type;
  if (action.type === "custom") {
    value = await prompt("YYYY-MM-DD or YYYY-MM-DD HH:MM");
    if (value === null || !singleLine(value)) return;
  }
  try {
    draft.due = parseDueInput(value, {
      now,
      timeZone: config.timeZone,
    });
  } catch (error) {
    notify("TickTick", error.message, "normal");
  }
}

function priorityEntries() {
  return [
    { type: "priority", value: 0, name: "None", label: "None" },
    { type: "priority", value: 1, name: "Low", label: "Low" },
    { type: "priority", value: 3, name: "Medium", label: "Medium" },
    { type: "priority", value: 5, name: "High", label: "High" },
  ];
}

function writableProjects(projects) {
  return projects.filter(
    (project) =>
      project &&
      !project.closed &&
      String(project.kind || "").toUpperCase() !== "NOTE" &&
      String(project.permission || "write").toLowerCase() !== "read",
  );
}

function commaSeparated(value) {
  return String(value)
    .split(",")
    .map((item) => singleLine(item))
    .filter(Boolean);
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
