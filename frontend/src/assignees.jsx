import Icon from "./icons";
import { useI18n } from "./i18n";

export function projectAssignees(project) {
  const raw = project?.assigned_to;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw && typeof raw === "object") return [raw];
  return [];
}

export function assigneeNames(project, empty = "") {
  const names = projectAssignees(project)
    .map((person) => person.name)
    .filter(Boolean);
  return names.length ? names.join(" · ") : empty;
}

export function isAssignedTo(project, userId) {
  return projectAssignees(project).some((person) => String(person.id) === String(userId));
}

export function isAdminUser(person) {
  return person?.role === "ADMINISTRATORS" || person?.user_type === "admin" || person?.is_superuser;
}

export function workerUsers(users) {
  return (users || []).filter((person) => person && person.is_active !== false && !isAdminUser(person));
}

export function AssigneePicker({ users, value, onChange, disabled }) {
  const { t } = useI18n();
  const people = workerUsers(users);
  const selected = (value || []).map(Number);

  const toggle = (id, event) => {
    if (event) event.stopPropagation();
    if (disabled) return;
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    onChange(next);
  };

  if (!people.length) {
    return <div className="muted small">{t("projects.noUsers")}</div>;
  }

  return (
    <div className="assignee-pick">
      {people.map((person) => {
        const on = selected.includes(Number(person.id));
        return (
          <button
            key={person.id}
            type="button"
            className={`worker-chip ${on ? "on" : ""}`}
            disabled={disabled}
            onClick={(e) => toggle(Number(person.id), e)}
          >
            <span className="avatar xs">{person.initials || "?"}</span>
            <span>{person.name}</span>
            {on && <Icon name="check" size={12} />}
          </button>
        );
      })}
    </div>
  );
}
