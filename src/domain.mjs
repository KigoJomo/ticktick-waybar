const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
export const TICKTICK_GLYPH = "\uf5cb";

function tickTickMark() {
  return `<span font_family="Simple Icons" size="90%" rise="-512">${TICKTICK_GLYPH}</span>`;
}

export function parseCliJson(output) {
  const text = String(output ?? "").trim();
  if (!text) return [];

  try {
    return JSON.parse(text);
  } catch {
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

export function asArray(value, preferredKeys = []) {
  if (Array.isArray(value)) return value.flat();
  for (const key of preferredKeys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return value && typeof value === "object" ? [value] : [];
}

export function escapePango(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function singleLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function dateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function parseDueInput(
  value,
  { now = new Date(), timeZone = systemTimeZone() } = {},
) {
  const input = singleLine(value);
  const lowered = input.toLowerCase();
  let date;
  let time = null;

  if (lowered === "today" || lowered === "tomorrow") {
    date = dateKey(now, timeZone);
    if (lowered === "tomorrow") date = shiftDateKey(date, 1);
  } else {
    const match = input.match(
      /^(\d{4}-\d{2}-\d{2})(?:[ t](\d{2}):(\d{2}))?$/,
    );
    if (!match) {
      throw new Error(
        "Use today, tomorrow, YYYY-MM-DD or YYYY-MM-DD HH:MM",
      );
    }
    date = match[1];
    if (match[2] !== undefined) time = `${match[2]}:${match[3]}`;
  }

  assertDateKey(date);
  if (!time) {
    return {
      allDay: true,
      dueDate: `${date}T00:00:00.000Z`,
      label: date,
      timeZone,
    };
  }

  const dueDate = zonedDateTimeToIso(date, time, timeZone);
  return {
    allDay: false,
    dueDate,
    label: `${date} ${time}`,
    timeZone,
  };
}

function shiftDateKey(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  return shifted.toISOString().slice(0, 10);
}

function assertDateKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${value}`);
  }
}

function zonedDateTimeToIso(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) throw new Error(`Invalid time: ${time}`);

  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(candidate), timeZone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    candidate -= represented - target;
  }

  const resolved = zonedParts(new Date(candidate), timeZone);
  if (
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== hour ||
    resolved.minute !== minute
  ) {
    throw new Error(`The local time ${date} ${time} does not exist`);
  }
  return new Date(candidate).toISOString();
}

function zonedParts(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
  };
}

export function taskDateKey(task, timeZone) {
  const raw = task.dueDate || task.startDate;
  if (!raw) return null;
  if (task.isAllDay && DATE_PREFIX.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateKey(parsed, timeZone);
}

export function classifyTask(task, now = new Date(), timeZone = systemTimeZone()) {
  const taskKey = taskDateKey(task, timeZone);
  if (!taskKey) return "unscheduled";
  const today = dateKey(now, timeZone);
  if (taskKey < today) return "overdue";
  if (taskKey === today) return "today";
  return "upcoming";
}

export function systemTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function sortTasks(tasks, now = new Date(), timeZone = systemTimeZone()) {
  const rank = { overdue: 0, today: 1, upcoming: 2, unscheduled: 3 };
  return [...tasks].sort((left, right) => {
    const classification =
      rank[classifyTask(left, now, timeZone)] -
      rank[classifyTask(right, now, timeZone)];
    if (classification) return classification;

    const leftDate = taskDateKey(left, timeZone) || "9999-12-31";
    const rightDate = taskDateKey(right, timeZone) || "9999-12-31";
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);

    const priority = Number(right.priority || 0) - Number(left.priority || 0);
    if (priority) return priority;
    return singleLine(left.title).localeCompare(singleLine(right.title));
  });
}

export function dueTasks(tasks, now = new Date(), timeZone = systemTimeZone()) {
  return sortTasks(
    tasks.filter((task) => {
      const classification = classifyTask(task, now, timeZone);
      return classification === "overdue" || classification === "today";
    }),
    now,
    timeZone,
  );
}

export function resolveInbox(projects) {
  return (
    projects.find((project) => project.isInbox || project.kind === "INBOX") ||
    projects.find((project) => String(project.name).toLowerCase() === "inbox") ||
    projects.find((project) => String(project.id).toLowerCase() === "inbox") ||
    null
  );
}

export function inferInboxProjectId(tasks) {
  return (
    tasks.find((task) =>
      String(task.projectId || "")
        .toLowerCase()
        .startsWith("inbox"),
    )?.projectId || null
  );
}

function taskLabel(task, now, timeZone) {
  const state = classifyTask(task, now, timeZone);
  const marker = state === "overdue" ? "!" : " ";
  const priority = Number(task.priority || 0) >= 5 ? " ↑" : "";
  return `${marker} ☐ ${singleLine(task.title)}${priority}`;
}

export function buildTaskMenu(
  tasks,
  { includeAllAction = true, now = new Date(), timeZone = systemTimeZone() } = {},
) {
  const due = dueTasks(tasks, now, timeZone);
  const entries = [
    { type: "add", label: "＋  Quick add" },
    { type: "add-detailed", label: "✎  Detailed task" },
  ];
  entries.push(
    ...due.map((task) => ({
      type: "complete",
      task,
      label: taskLabel(task, now, timeZone),
    })),
  );
  if (includeAllAction) {
    entries.push({ type: "all", label: "…  All open tasks" });
  }
  return entries;
}

export function buildAllTaskMenu(
  tasks,
  { now = new Date(), timeZone = systemTimeZone() } = {},
) {
  return sortTasks(tasks, now, timeZone).map((task) => ({
    type: "complete",
    task,
    label: taskLabel(task, now, timeZone),
  }));
}

function tooltipSection(title, tasks, limit) {
  if (!tasks.length || limit <= 0) return [];
  return [
    `<b>${title}</b>`,
    ...tasks.slice(0, limit).map((task) => `• ${escapePango(singleLine(task.title))}`),
  ];
}

export function buildWaybarStatus(
  tasks,
  {
    now = new Date(),
    timeZone = systemTimeZone(),
    tooltipLimit = 8,
    stale = false,
  } = {},
) {
  const due = dueTasks(tasks, now, timeZone);
  const overdue = due.filter(
    (task) => classifyTask(task, now, timeZone) === "overdue",
  );
  const today = due.filter(
    (task) => classifyTask(task, now, timeZone) === "today",
  );
  const remaining = Math.max(0, tooltipLimit - overdue.length);
  const lines = [
    ...tooltipSection("Overdue", overdue, tooltipLimit),
    ...(overdue.length && today.length ? [""] : []),
    ...tooltipSection("Today", today, remaining),
  ];

  let cssClass = overdue.length ? "overdue" : due.length ? "active" : "clear";
  if (stale) cssClass = overdue.length ? "stale-overdue" : "stale";

  return {
    text: due.length ? `${tickTickMark()} ${due.length}` : tickTickMark(),
    tooltip: lines.length ? lines.join("\n") : "No tasks due today",
    class: cssClass,
  };
}

export function errorStatus(error, cachedTasks = null, options = {}) {
  const message = String(error?.stderr || error?.message || error || "");
  const locked = /auth|log[ -]?in|token|unauthori[sz]ed|401/i.test(message);
  if (cachedTasks) {
    return buildWaybarStatus(cachedTasks, { ...options, stale: true });
  }
  return {
    text: locked ? `${tickTickMark()} 󰌾` : `${tickTickMark()} !`,
    tooltip: locked
      ? "TickTick is not connected\nRun: tickbar auth"
      : "TickTick is unavailable\nRun: tickbar status",
    class: locked ? "locked" : "error",
  };
}
