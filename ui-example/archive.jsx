// Archive section + actions on objects (complete / delete / restore)
const ARCH_MONTHS_LV = ["Janvāris","Februāris","Marts","Aprīlis","Maijs","Jūnijs","Jūlijs","Augusts","Septembris","Oktobris","Novembris","Decembris"];

const Archive = ({ user }) => {
  const D = window.PROCOAT_DATA;
  const [tab, setTab] = React.useState("completed");
  const [period, setPeriod] = React.useState(null); // null = all time
  const [, setRev] = React.useState(0);

  const archive = D.archive || (D.archive = []);
  const completed = D.objects.filter(o => o.status === "completed").map(o => ({
    object: o, reason: "completed", archivedAt: o.endDate
  }));
  const deleted = archive.filter(a => a.reason === "deleted");
  const all = [...completed, ...archive];

  const inPeriod = (item) => {
    if (!period) return true;
    const d = item.archivedAt;
    return d && d >= period.from && d <= period.to;
  };

  const sourceTab = tab === "completed" ? completed : tab === "deleted" ? deleted : all;
  const list = sourceTab.filter(inPeriod);

  const restore = (item) => {
    const obj = item.object;
    obj.status = "active";
    if (!D.objects.includes(obj)) D.objects.push(obj);
    D.archive = archive.filter(a => a !== item);
    setRev(r => r + 1);
  };
  const purge = (item) => {
    if (!confirm(`Neatgriezeniski dzēst #${item.object.id} ${item.object.client}?`)) return;
    D.archive = archive.filter(a => a !== item);
    setRev(r => r + 1);
  };

  // Stats — across all months for KPIs
  const totalArchivedM2 = all.reduce((s, a) => s + a.object.totalM2, 0);
  const totalKgUsed = all.reduce((s, a) => s + a.object.materials.reduce((x, m) => x + m.taken, 0), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">VĒSTURE UN ARHĪVS</div>
          <h1 className="page-title">Arhīvs</h1>
          <p className="page-sub">Pabeigti un dzēsti objekti. Tikai administratoram.</p>
        </div>
        <div className="page-actions">
          <PeriodPicker value={period} onChange={setPeriod} />
          {period && <button className="btn btn-ghost" onClick={() => setPeriod(null)}>Notīrīt</button>}
        </div>
      </header>

      <section className="kpis">
        <div className="kpi"><div className="kpi-label">Pabeigti objekti</div><div className="kpi-value mono">{completed.length}</div><div className="kpi-meta">Aktīvi mapē</div></div>
        <div className="kpi"><div className="kpi-label">Dzēsti</div><div className="kpi-value mono">{deleted.length}</div><div className="kpi-meta">Atjaunojami 30 dienas</div></div>
        <div className="kpi"><div className="kpi-label">Kopējais arhivētais apjoms</div><div className="kpi-value mono">{totalArchivedM2}<span className="kpi-unit">m²</span></div></div>
        <div className="kpi"><div className="kpi-label">Iztērēts materiāls</div><div className="kpi-value mono">{totalKgUsed.toFixed(0)}<span className="kpi-unit">kg</span></div></div>
      </section>

      <section className="card">
        <div className="seg" style={{marginBottom: 16}}>
          <button className={`seg-btn ${tab === "completed" ? "on" : ""}`} onClick={() => setTab("completed")}>✓ Pabeigti ({completed.length})</button>
          <button className={`seg-btn ${tab === "deleted" ? "on" : ""}`} onClick={() => setTab("deleted")}>🗑 Dzēsti ({deleted.length})</button>
          <button className={`seg-btn ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>Visi arhivētie ({all.length})</button>
        </div>

        <table className="table">
          <thead><tr><th></th><th>Objekts</th><th>Sistēma</th><th>Apjoms</th><th>Statuss / iemesls</th><th>Datums</th><th></th></tr></thead>
          <tbody>
            {list.map((item, i) => {
              const o = item.object;
              return (
                <tr key={i}>
                  <td><span className="obj-dot" style={{ background: o.color, width: 12, height: 12, display: "inline-block" }} /></td>
                  <td><strong>#{o.id}</strong> {o.client} <div className="muted small">{o.address}</div></td>
                  <td>{o.system}</td>
                  <td className="mono">{o.totalM2} m²</td>
                  <td><span className={`status ${item.reason === "deleted" ? "status-planned" : "status-completed"}`}>{item.reason === "deleted" ? "Dzēsts" : "Pabeigts"}</span></td>
                  <td className="mono small">{item.archivedAt || "—"}</td>
                  <td className="ta-r">
                    {item.reason === "deleted" && (
                      <button className="icon-btn sm" title="Atjaunot" onClick={() => restore(item)}><Icon name="arrowRight" size={13} /></button>
                    )}
                    {item.reason === "deleted" && (
                      <button className="icon-btn sm danger" title="Neatgriezeniski dzēst" onClick={() => purge(item)}><Icon name="trash" size={13} /></button>
                    )}
                    {item.reason !== "deleted" && (
                      <button className="icon-btn sm" title="Skatīt"><Icon name="edit" size={13} /></button>
                    )}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan="7" className="muted small ta-c" style={{padding: 30}}>Šajā mapē nav ierakstu.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

window.Archive = Archive;
