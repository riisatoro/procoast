import Icon from "./icons";
import { useI18n } from "./i18n";

const PALETTE = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];
const num = (v) => Number(v || 0);

export function normalizeReportEntry(row) {
  const project = row.project && typeof row.project === "object"
    ? row.project
    : {
        id: row.object_id || row.project_id,
        name: row.project_name || row.client || "",
        client: row.client || "",
        address: row.address || "",
        color: row.color || "",
        system: row.system || "",
      };
  const person = row.recorded_by && typeof row.recorded_by === "object"
    ? row.recorded_by
    : {
        name: row.worker_name || row.assigned_to || "",
        initials: row.worker || row.initials || "",
      };
  const tasks = (row.tasks || row.task_lines || [])
    .filter((line) => num(line.quantity) > 0)
    .map((line) => ({
      id: line.id,
      name: line.name || line.task_detail?.name || "",
      quantity: line.quantity,
      unit: line.unit || line.task_detail?.unit || "m²",
    }));
  const materials = (row.materials || row.material_lines || [])
    .filter((line) => num(line.quantity) > 0)
    .map((line) => ({
      id: line.id,
      name: line.name || line.material_detail?.name || "",
      color: line.color || line.material_detail?.color || "",
      quantity: line.quantity,
      unit: line.unit || line.material_detail?.unit || "kg",
    }));
  return {
    id: row.id,
    project,
    person,
    tasks,
    materials,
    notes: row.notes || "",
    workDate: row.work_date || "",
    at: row.updated_at || row.created_at || "",
  };
}

const qtyLabel = (value) => {
  const n = num(value);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
};

const ReportEntry = ({
  row,
  hideProject,
  hidePerson,
  onSelectProject,
  onOpen,
  action,
}) => {
  const { t, dateLocale } = useI18n();
  const entry = normalizeReportEntry(row);
  const project = entry.project || {};
  const person = entry.person || {};
  const color = project.color || PALETTE[(project.id || 0) % PALETTE.length];
  const projectTitle = project.client || project.name || t("common.dash");
  const when = entry.at
    ? new Date(entry.at).toLocaleString(dateLocale, {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const dateLabel = entry.workDate
    ? new Date(`${entry.workDate}T12:00:00`).toLocaleDateString(dateLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  const empty = !entry.tasks.length && !entry.materials.length && !entry.notes;
  const openable = Boolean(onOpen && entry.id);

  return (
    <article
      className={`entry-card ${openable ? "clickable" : ""}`}
      role={openable ? "button" : undefined}
      tabIndex={openable ? 0 : undefined}
      onClick={() => openable && onOpen(entry.id)}
      onKeyDown={(e) => {
        if (!openable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(entry.id);
        }
      }}
      style={{ "--entry-color": color }}
    >
      <header className="entry-card-head">
        <div className="entry-ident">
          {!hideProject && (
            <div
              className={`entry-project ${onSelectProject && project.id ? "clickable" : ""}`}
              role={onSelectProject && project.id ? "button" : undefined}
              onClick={(e) => {
                if (project.id && onSelectProject) {
                  e.stopPropagation();
                  onSelectProject(project.id);
                }
              }}
            >
              <span className="obj-dot" style={{ background: color }} />
              {project.id ? <span className="mono small">#{project.id}</span> : null}
              <span className="entry-project-name">{projectTitle}</span>
              {project.address ? <span className="entry-project-addr">{project.address}</span> : null}
            </div>
          )}
          {!hidePerson && (
            <div className="entry-person">
              <span className="avatar sm">{person.initials || "?"}</span>
              <div>
                <div className="entry-person-label">{t("entry.enteredBy")}</div>
                <div className="entry-person-name">{person.name || t("common.dash")}</div>
              </div>
            </div>
          )}
          {(dateLabel || when) && (
            <div className="entry-when muted small">{[dateLabel, when].filter(Boolean).join(" · ")}</div>
          )}
        </div>
        {action ? (
          <div className="entry-card-action" onClick={(e) => e.stopPropagation()}>{action}</div>
        ) : openable ? (
          <span className="entry-open muted small">{t("entry.open")}</span>
        ) : null}
      </header>

      {empty ? (
        <div className="muted small">{t("entry.empty")}</div>
      ) : (
        <div className="entry-body">
          {entry.tasks.length > 0 && (
            <div className="entry-group">
              <div className="entry-group-label">{t("entry.works")}</div>
              <div className="entry-chips">
                {entry.tasks.map((line) => (
                  <span key={line.id || line.name} className="entry-chip entry-chip-task">
                    <strong className="mono">{qtyLabel(line.quantity)} {line.unit}</strong>
                    <span>{line.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {entry.materials.length > 0 && (
            <div className="entry-group">
              <div className="entry-group-label">{t("entry.materials")}</div>
              <div className="entry-chips">
                {entry.materials.map((line) => (
                  <span key={line.id || line.name} className="entry-chip entry-chip-mat">
                    <strong className="mono">{qtyLabel(line.quantity)} {line.unit}</strong>
                    <span>{line.name}{line.color ? ` · ${line.color}` : ""}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {entry.notes ? (
            <p className="entry-notes">
              <Icon name="clipboard" size={12} /> {entry.notes}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
};

export default ReportEntry;
