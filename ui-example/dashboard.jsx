// Dashboard for admin
const MONTHS_LV = ["Janvāris","Februāris","Marts","Aprīlis","Maijs","Jūnijs","Jūlijs","Augusts","Septembris","Oktobris","Novembris","Decembris"];
// Mock per-month m² so any picked period can sum to a realistic value
const MONTHLY_M2 = { "2026-01": 540, "2026-02": 580, "2026-03": 612, "2026-04": 718, "2026-05": 847, "2026-06": 240, "2025-12": 510, "2025-11": 490 };

// Sum monthly m² across a date range. Approximates partial months by day fraction.
const sumPeriodM2 = (from, to) => {
  if (!from || !to) return 0;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  let total = 0;
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const key = `${y}-${String(m).padStart(2,"0")}`;
    const monthTotal = MONTHLY_M2[key] || 0;
    const daysInMonth = new Date(y, m, 0).getDate();
    const startDay = (y === fy && m === fm) ? fd : 1;
    const endDay = (y === ty && m === tm) ? td : daysInMonth;
    total += Math.round(monthTotal * (endDay - startDay + 1) / daysInMonth);
    m++; if (m > 12) { m = 1; y++; }
  }
  return total;
};

const Dashboard = ({ user, onNavigate, onSelectObject }) => {
  const D = window.PROCOAT_DATA;
  const [, setRev] = React.useState(0);
  const [period, setPeriod] = React.useState({ from: "2026-05-01", to: "2026-05-31", label: "Maijs 2026" });

  const completeObject = (o) => {
    if (!confirm(`Atzīmēt #${o.id} ${o.client} kā pabeigtu?`)) return;
    o.status = "completed";
    o.doneM2 = o.totalM2;
    (D.archive = D.archive || []);
    setRev(r => r + 1);
  };
  const deleteObject = (o) => {
    if (!confirm(`Pārvietot #${o.id} ${o.client} uz arhīvu (dzēsti)?`)) return;
    D.archive = D.archive || [];
    D.archive.push({ object: o, reason: "deleted", archivedAt: "2026-05-06" });
    D.objects = D.objects.filter(x => x !== o);
    setRev(r => r + 1);
  };
  const active = D.objects.filter(o => o.status === "active");
  const completed = D.objects.filter(o => o.status === "completed");
  const planned = D.objects.filter(o => o.status === "planned");
  // Visible objects: active + planned + completed (NO deleted — they live in archive only)
  const visible = [...active, ...completed];
  const totalDone = D.objects.reduce((s, o) => s + o.doneM2, 0);
  const totalAllM2 = D.objects.reduce((s, o) => s + o.totalM2, 0);
  const archivedM2 = (D.archive || []).reduce((s, a) => s + a.object.totalM2, 0);
  const totalEverM2 = totalAllM2 + archivedM2; // includes archived — true cumulative
  const avgProgress = Math.round((totalDone / totalAllM2) * 100);

  const monthM2 = sumPeriodM2(period.from, period.to);
  // Compute an equally-long previous period for the % comparison
  const prevPeriod = (() => {
    const [fy, fm, fd] = period.from.split("-").map(Number);
    const [ty, tm, td] = period.to.split("-").map(Number);
    const fromD = new Date(fy, fm - 1, fd);
    const toD = new Date(ty, tm - 1, td);
    const lenDays = Math.round((toD - fromD) / 86400000) + 1;
    const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - lenDays + 1);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    return { from: fmt(prevFrom), to: fmt(prevTo) };
  })();
  const prevM2 = sumPeriodM2(prevPeriod.from, prevPeriod.to);
  const monthDelta = prevM2 ? Math.round(((monthM2 - prevM2) / prevM2) * 100) : 0;

  const statusLabel = { active: "Aktīvs", completed: "Pabeigts", planned: "Plānots" };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{period.label.toUpperCase()} · KOPSAVILKUMS</div>
          <h1 className="page-title">Sveiks, {user.name.split(" ")[0]}.</h1>
          <p className="page-sub">Šeit ir šodienas situācija visos objektos.</p>
        </div>
        <div className="page-actions">
          <PeriodPicker value={period} onChange={setPeriod} />
          <button className="btn btn-ghost"><Icon name="download" size={15} /> Eksportēt</button>
          <button className="btn btn-primary" onClick={() => onNavigate("calendar")}>
            <Icon name="calendarPlus" size={15} /> Jauns ieraksts
          </button>
        </div>
      </header>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-label">Aktīvi objekti</div>
          <div className="kpi-value mono">{active.length}</div>
          <div className="kpi-meta">{planned.length} plānoti · {completed.length} pabeigti</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Vidējais progress</div>
          <div className="kpi-value mono">{avgProgress}<span className="kpi-unit">%</span></div>
          <div className="kpi-meta">{totalDone} / {totalAllM2} m²</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{period.label} · paveikts</div>
          <div className="kpi-value mono">{monthM2}<span className="kpi-unit">m²</span></div>
          <div className={`kpi-meta ${monthDelta >= 0 ? "accent-up" : "accent-down"}`}>
            {monthDelta >= 0 ? "+" : ""}{monthDelta}% pret iepriekšējo periodu
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Kopējais apjoms</div>
          <div className="kpi-value mono">{totalEverM2}<span className="kpi-unit">m²</span></div>
          <div className="kpi-meta">Visu laiku · {D.objects.length + (D.archive?.length || 0)} objekti</div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Aktīvo objektu progress</h2>
            <button className="link" onClick={() => onNavigate("reports")}>Visas atskaites →</button>
          </div>
          <div className="obj-list">
            {visible.map(o => {
              const pct = Math.round((o.doneM2 / o.totalM2) * 100);
              return (
                <div key={o.id} className="obj-row">
                  <div className="obj-row-head">
                    <span className="obj-dot" style={{ background: o.color }} />
                    <span className="obj-id mono">#{o.id}</span>
                    <button className="obj-name" style={{background: "none", border: 0, padding: 0, textAlign: "left", flex: 1, cursor: "pointer", fontWeight: 600}} onClick={() => onSelectObject && onSelectObject(o.id)}>{o.client}</button>
                    <span className={`status status-${o.status}`}>{statusLabel[o.status]}</span>
                    <span className="obj-pct mono">{pct}%</span>
                    {user.role === "ADMINISTRATORS" && o.status !== "completed" && (
                      <button className="icon-btn sm" title="Atzīmēt kā pabeigtu" onClick={() => completeObject(o)}><Icon name="check" size={13} /></button>
                    )}
                    {user.role === "ADMINISTRATORS" && (
                      <button className="icon-btn sm danger" title="Dzēst (uz arhīvu)" onClick={() => deleteObject(o)}><Icon name="trash" size={13} /></button>
                    )}
                  </div>
                  <div className="bar"><div className="bar-fill" style={{ width: pct + "%", background: o.status === "completed" ? "#4CAF50" : "#2C5F2E" }} /></div>
                  <div className="obj-row-meta">
                    <span>{o.system}</span>
                    <span className="mono">{o.doneM2} / {o.totalM2} m²</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Šodienas atskaites</h2>
            <span className="badge">{D.todayReports.length} ieraksti</span>
          </div>
          <div className="reports-feed">
            {D.todayReports.map((r, i) => {
              const obj = D.objects.find(o => o.id === r.objectId);
              const wk = D.users.find(u => u.initials === r.worker);
              return (
                <div key={i} className="feed-row">
                  <div className="avatar sm">{r.worker}</div>
                  <div className="feed-body">
                    <div className="feed-line">
                      <strong>{wk?.name || r.worker}</strong>
                      <span className="muted">·</span>
                      <span className="mono small">#{obj.id}</span>
                      <span>{obj.client}</span>
                    </div>
                    <div className="feed-sub">{r.summary}</div>
                  </div>
                  <div className="feed-time mono">14:32</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Materiālu kopējais patēriņš · maijs</h2>
          <span className="muted small">Vajadzīgs vs. paņemts no noliktavas</span>
        </div>
        <div className="mat-grid">
          {[
            { name: "EP02 Color", needed: 450, taken: 250 },
            { name: "EP11", needed: 450, taken: 75 },
            { name: "EP12", needed: 50, taken: 45 },
            { name: "EP22", needed: 150, taken: 150 },
            { name: "Akrila Pārslas", needed: 210, taken: 70 },
            { name: "Kvarca smilts", needed: 850, taken: 590 },
          ].map(m => {
            const pct = Math.round((m.taken / m.needed) * 100);
            return (
              <div key={m.name} className="mat-mini">
                <div className="mat-mini-head">
                  <span className="mat-mini-name">{m.name}</span>
                  <span className="mono small">{m.taken}/{m.needed} kg</span>
                </div>
                <div className="bar sm"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

window.Dashboard = Dashboard;
