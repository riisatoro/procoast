export function objectUiStatus(status) {
  if (status === "closed" || status === "completed") return "completed";
  if (status === "deleted") return "deleted";
  if (status === "open" || status === "planned") return "planned";
  return "active";
}

export function objectStatusClass(status) {
  const ui = objectUiStatus(status);
  return `status status-${ui === "deleted" ? "planned" : ui}`;
}

export const OBJECT_STATUS_LABEL = {
  active: "status.active",
  completed: "status.completed",
  planned: "status.planned",
  deleted: "status.deleted",
};
