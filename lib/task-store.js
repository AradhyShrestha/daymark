const TASKS_KEY = "daymark.tasks.v1";
const WORKSPACES_KEY = "daymark.workspaces.v1";
const DEFAULT_WORKSPACE_ID = "personal";
const LEGACY_OWNER_KEY = "daymark.legacy-owner.v1";

function canClaimLegacyData(accountId) {
  const owner = window.localStorage.getItem(LEGACY_OWNER_KEY);
  if (owner) return owner === accountId;
  window.localStorage.setItem(LEGACY_OWNER_KEY, accountId);
  return true;
}

export function readWorkspaces(accountId = "guest", username = "Jordan") {
  const fallback = [{ id: DEFAULT_WORKSPACE_ID, name: `${username}’s space`, description: "Personal workspace" }];
  try {
    const workspaceKey = `${WORKSPACES_KEY}:${accountId}`;
    let saved = window.localStorage.getItem(workspaceKey);
    if (!saved && accountId === "guest") saved = window.localStorage.getItem(WORKSPACES_KEY);
    if (!saved && accountId !== "guest" && canClaimLegacyData(accountId)) {
      saved = window.localStorage.getItem(WORKSPACES_KEY);
      if (saved) window.localStorage.setItem(workspaceKey, saved);
    }
    if (!saved) return fallback;
    const workspaces = JSON.parse(saved);
    if (!Array.isArray(workspaces)) return fallback;
    const validWorkspaces = workspaces.filter((workspace) => workspace
      && typeof workspace.id === "string"
      && typeof workspace.name === "string"
      && typeof workspace.description === "string");
    return validWorkspaces.length ? validWorkspaces : fallback;
  } catch {
    return fallback;
  }
}

export function writeWorkspaces(workspaces, accountId = "guest") {
  try {
    window.localStorage.setItem(`${WORKSPACES_KEY}:${accountId}`, JSON.stringify(workspaces));
  } catch {
    // Browser storage can be unavailable or out of space.
  }
}

export function readTasks(workspaceId = DEFAULT_WORKSPACE_ID, accountId = "guest") {
  try {
    const workspaceKey = `${TASKS_KEY}:${accountId}:${workspaceId}`;
    let saved = window.localStorage.getItem(workspaceKey);
    if (!saved && accountId === "guest") {
      saved = window.localStorage.getItem(`${TASKS_KEY}:${workspaceId}`);
      if (!saved && workspaceId === DEFAULT_WORKSPACE_ID) saved = window.localStorage.getItem(TASKS_KEY);
      if (saved) window.localStorage.setItem(workspaceKey, saved);
    }
    if (!saved && accountId !== "guest" && workspaceId === DEFAULT_WORKSPACE_ID && canClaimLegacyData(accountId)) {
      saved = window.localStorage.getItem(`${TASKS_KEY}:${workspaceId}`) ?? window.localStorage.getItem(TASKS_KEY);
      if (saved) window.localStorage.setItem(workspaceKey, saved);
    }
    if (!saved) return null;
    const tasks = JSON.parse(saved);
    if (!Array.isArray(tasks)) return null;
    return tasks.filter((task) => task
      && typeof task.id === "string"
      && typeof task.title === "string"
      && typeof task.dueDate === "string"
      && typeof task.completed === "boolean"
      && typeof task.createdAt === "string"
      && ["Work", "Personal", "Learning"].includes(task.category)
      && ["low", "normal", "high"].includes(task.priority));
  } catch {
    return null;
  }
}

export function writeTasks(tasks, workspaceId = DEFAULT_WORKSPACE_ID, accountId = "guest") {
  try {
    window.localStorage.setItem(`${TASKS_KEY}:${accountId}:${workspaceId}`, JSON.stringify(tasks));
  } catch {
    // Browser storage can be unavailable or out of space.
  }
}

export function deleteWorkspaceTasks(workspaceId, accountId = "guest") {
  try {
    window.localStorage.removeItem(`${TASKS_KEY}:${accountId}:${workspaceId}`);
    if (window.localStorage.getItem(LEGACY_OWNER_KEY) === accountId) {
      window.localStorage.removeItem(`${TASKS_KEY}:${workspaceId}`);
      if (workspaceId === DEFAULT_WORKSPACE_ID) window.localStorage.removeItem(TASKS_KEY);
    }
  } catch {
    // Browser storage can be unavailable.
  }
}