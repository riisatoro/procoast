import { useEffect, useState } from "react";
import Icon from "./icons";
import { fetchArchivedProjects } from "./api";
import { ProjectDetail, STATUS_LABEL, statusClass } from "./projects";
import { useI18n } from "./i18n";

const Archive = ({ user }) => {
  const { t, dateLocale } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async () => setItems(await fetchArchivedProjects());

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (selected) {
    return (
      <ProjectDetail
        user={user}
        projectId={selected}
        readOnly
        onBack={() => {
          setSelected(null);
          load().catch(() => {});
        }}
      />
    );
  }

  const totalExpenses = items.reduce((s, p) => s + Number(p.expenses_total || 0), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("archive.eyebrow")}</div>
          <h1 className="page-title">{t("archive.title")}</h1>
          <p className="page-sub">{t("archive.sub")}</p>
        </div>
      </header>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-label">{t("archive.closedProjects")}</div>
          <div className="kpi-value mono">{items.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("archive.totalExpenses")}</div>
          <div className="kpi-value mono">{totalExpenses.toFixed(2)}<span className="kpi-unit">€</span></div>
        </div>
      </section>

      {loading ? (
        <section className="card muted">{t("common.loading")}</section>
      ) : items.length === 0 ? (
        <section className="card muted">{t("archive.empty")}</section>
      ) : (
        <section className="card">
          <table className="table">
            <thead>
              <tr>
                <th>{t("archive.project")}</th>
                <th>{t("common.client")}</th>
                <th>{t("archive.assignee")}</th>
                <th>{t("archive.expenses")}</th>
                <th>{t("archive.closed")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="dt-name">{p.name}</div>
                    <span className={`status ${statusClass(p.status)}`}>{t(STATUS_LABEL[p.status])}</span>
                  </td>
                  <td>{p.client || t("common.dash")}</td>
                  <td>{p.assigned_to?.name}</td>
                  <td className="mono">{p.expenses_total} €</td>
                  <td className="mono small">{p.closed_at ? new Date(p.closed_at).toLocaleDateString(dateLocale) : t("common.dash")}</td>
                  <td className="ta-r">
                    <button className="btn btn-sm btn-outline" onClick={() => setSelected(p.id)}>{t("common.view")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};

export default Archive;
