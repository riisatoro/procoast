// Object Detail page — full timeline + tasks + materials + history
const ObjectDetail = ({ user, objectId, onBack, onNavigate }) => {
  const D = window.PROCOAT_DATA;
  const obj = D.objects.find(o => o.id === objectId) || D.objects[0];
  const isAdmin = user.role === "ADMINISTRATORS";
  const pct = Math.round((obj.doneM2 / obj.totalM2) * 100);

  const events = D.events.filter(e => e.objectId === obj.id);
  const totalKgNeeded = obj.materials.reduce((s, m) => s + m.needed, 0);
  const totalKgTaken = obj.materials.reduce((s, m) => s + m.taken, 0);
  const matPct = Math.round((totalKgTaken / totalKgNeeded) * 100);

  // Synthetic timeline derived from events + tasks
  const timeline = React.useMemo(() => {
    const items = [];
    items.push({
      date: obj.startDate,
      title: "Objekta uzsākšana",
      desc: "Reģistrēts platformā · sākotnējais materiālu aprēķins",
      workers: [],
      status: "done",
    });
    // Add events as timeline rows
    events
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start))
      .forEach(e => {
        const today = "2026-05-06";
        let status = "planned";
        if (e.end < today) status = "done";
        else if (e.start <= today && e.end >= today) status = "current";
        items.push({
          date: e.start,
          dateEnd: e.end,
          title: e.system,
          desc: `${e.start} → ${e.end}`,
          workers: e.workers,
          status,
        });
      });
    // Final delivery row
    if (obj.status !== "completed") {
      items.push({
        date: obj.endDate,
        title: "Plānotā nodošana klientam",
        desc: "Finiš pārbaude un nodošanas akts",
        workers: [],
        status: "planned",
      });
    } else {
      items.push({
        date: obj.endDate,
        title: "Objekts pabeigts un nodots",
        desc: "Klients akceptējis",
        workers: [],
        status: "done",
      });
    }
    return items;
  }, [obj, events]);

  const statusLabel = { active: "Aktīvs", completed: "Pabeigts", planned: "Plānots" };

  // Material consumption summary
  const recentTakes = [
    { date: "2026-05-05", worker: "AK", mat: "EP02 Color", qty: 25 },
    { date: "2026-05-04", worker: "KF", mat: "EP22", qty: 50 },
    { date: "2026-05-04", worker: "AK", mat: "Akrila Pārslas", qty: 35 },
    { date: "2026-05-02", worker: "DB", mat: "Kvarca smilts", qty: 100 },
  ];

  return (
    <div className="page">
      <header className="page-head obj-detail-head">
        <div>
          <button className="back-link" onClick={onBack}>
            <Icon name="chevronLeft" size={13} /> Atpakaļ
          </button>
          <div className="obj-detail-id-row">
            <span className="obj-dot" style={{ background: obj.color }} />
            <span className="obj-detail-id">#{obj.id}</span>
            <span className={`status status-${obj.status}`}>{statusLabel[obj.status]}</span>
          </div>
          <h1 className="page-title">{obj.client}</h1>
          <p className="page-sub"><Icon name="mapPin" size={12} /> {obj.address}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => onNavigate("reports")}>
            <Icon name="clipboard" size={15} /> Atskaite
          </button>
          {isAdmin && (
            <button className="btn btn-outline">
              <Icon name="edit" size={15} /> Rediģēt
            </button>
          )}
          <button className="btn btn-primary">
            <Icon name="download" size={15} /> Eksportēt PDF
          </button>
        </div>
      </header>

      <section className="obj-stats-grid">
        <div className="obj-stat">
          <div className="obj-stat-label">Progress</div>
          <div className="obj-stat-val">{pct}<span className="obj-stat-unit">%</span></div>
          <div className="bar sm" style={{marginTop: 8}}>
            <div className="bar-fill" style={{ width: pct + "%" }} />
          </div>
        </div>
        <div className="obj-stat">
          <div className="obj-stat-label">Apjoms</div>
          <div className="obj-stat-val">{obj.doneM2}<span className="obj-stat-unit">/ {obj.totalM2} m²</span></div>
          <div className="obj-stat-meta">{obj.totalM2 - obj.doneM2} m² atlikuši</div>
        </div>
        <div className="obj-stat">
          <div className="obj-stat-label">Materiāls</div>
          <div className="obj-stat-val">{matPct}<span className="obj-stat-unit">%</span></div>
          <div className="obj-stat-meta">{totalKgTaken} / {totalKgNeeded} kg paņemti</div>
        </div>
        <div className="obj-stat">
          <div className="obj-stat-label">Termiņš</div>
          <div className="obj-stat-val mono" style={{fontSize: 18}}>{obj.endDate}</div>
          <div className="obj-stat-meta">No {obj.startDate}</div>
        </div>
      </section>

      <div className="grid-2">
        {/* TIMELINE */}
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Laika līnija</h2>
            <span className="muted small">Visi posmi un piesaistes</span>
          </div>
          <div className="timeline">
            {timeline.map((t, i) => (
              <div key={i} className="tl-item">
                <div className={`tl-bullet ${t.status}`}>
                  {t.status === "done" && <Icon name="check" size={11} />}
                  {t.status === "current" && <Icon name="clock" size={11} />}
                  {t.status === "planned" && <Icon name="calendar" size={11} />}
                </div>
                <div className="tl-row-meta">
                  <span className="tl-date">{t.date}{t.dateEnd ? ` → ${t.dateEnd}` : ""}</span>
                  <span className={`tl-status-tag ${t.status}`}>
                    {t.status === "done" ? "Pabeigts" : t.status === "current" ? "Notiek" : "Plānots"}
                  </span>
                </div>
                <div className="tl-title">{t.title}</div>
                <div className="tl-desc">
                  <span>{t.desc}</span>
                  {t.workers && t.workers.length > 0 && (
                    <span className="tl-workers">
                      <Icon name="users" size={11} /> {t.workers.join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TASK PROGRESS */}
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Darbu progress</h2>
            <button className="link" onClick={() => onNavigate("reports")}>Reģistrēt →</button>
          </div>
          <div className="task-progress-list">
            {obj.tasks.map((t, i) => {
              const pct = Math.round((t.done / t.total) * 100);
              return (
                <div key={i} className="task-progress-row">
                  <div>
                    <div className="task-progress-name">{t.name}</div>
                    <div className="task-progress-vals">{t.done} / {t.total} {t.unit}</div>
                  </div>
                  <div className="mono" style={{fontWeight: 700}}>{pct}%</div>
                  <div className="task-progress-bar">
                    <div className="bar"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* MATERIALS TABLE */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Materiāli</h2>
          <button className="link" onClick={() => onNavigate("materials")}>Atvērt sarakstu →</button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Materiāls</th>
              <th>Krāsa / Tips</th>
              <th>Norma</th>
              <th>Vajadzīgs</th>
              <th>Paņemts</th>
              <th>Atlikums</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {obj.materials.map((m, i) => {
              const pct = Math.min(100, Math.round((m.taken / m.needed) * 100));
              const remain = m.needed - m.taken;
              return (
                <tr key={i}>
                  <td><strong>{m.name}</strong></td>
                  <td className="muted small">{m.color}</td>
                  <td className="mono small">{m.perM2} kg/m²</td>
                  <td className="mono">{m.needed} kg</td>
                  <td className="mono">{m.taken} kg</td>
                  <td className={`mono ${remain <= 0 ? "ok" : ""}`}>{remain <= 0 ? "0 kg ✓" : `${remain} kg`}</td>
                  <td style={{minWidth: 140}}>
                    <div className="bar sm"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
                    <div className="mono tiny muted" style={{marginTop: 3}}>{pct}%</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* RECENT ACTIVITY */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Pēdējās aktivitātes</h2>
          <span className="badge">{recentTakes.length} ieraksti</span>
        </div>
        <div className="activity-list">
          {recentTakes.map((r, i) => {
            const wk = D.users.find(u => u.initials === r.worker);
            return (
              <div key={i} className="activity-row">
                <div className="activity-date">{r.date}</div>
                <div>
                  <div className="activity-title">Paņemts {r.qty} kg <span className="muted">— {r.mat}</span></div>
                  <div className="activity-sub">
                    <span className="avatar xs" style={{display: "inline-grid", marginRight: 6, verticalAlign: "middle"}}>{r.worker}</span>
                    {wk?.name}
                  </div>
                </div>
                <div className="activity-hours mono">+{r.qty} kg</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

window.ObjectDetail = ObjectDetail;
