// Worker Profile page — hours worked + activity log
const WeekDaysShort = ["P", "O", "T", "C", "Pk", "S", "Sv"];

const WorkerProfile = ({ user, profileUserId, onBack, onNavigate, onSelectObject }) => {
  const D = window.PROCOAT_DATA;
  const target = D.users.find(u => u.id === profileUserId) || user;
  const isSelf = target.id === user.id;
  const isAdmin = user.role === "ADMINISTRATORS";
  const [period, setPeriod] = React.useState("week"); // week | month | year

  // Mock hours per day for current week (May 4-10, 2026; today = May 6)
  // index 0 = Mon (May 4)
  const HOURS_BY_USER = {
    AK: [9, 8.5, 7.5, 0, 0, 0, 0],
    KF: [8, 8, 8, 0, 0, 0, 0],
    DB: [9.5, 8, 0, 0, 0, 0, 0],
    IG: [8, 8, 6, 0, 0, 0, 0],
    MV: [0, 8, 8, 0, 0, 0, 0],
    JR: [0, 0, 0, 0, 0, 0, 0],
  };
  const weekHours = HOURS_BY_USER[target.initials] || [8, 8, 7, 0, 0, 0, 0];
  const today = 2; // index for May 6 (Wednesday)

  const totalWeek = weekHours.reduce((s, h) => s + h, 0);
  const totalMonth = totalWeek + 64; // mock previous weeks
  const totalYear = totalMonth + 612; // mock cumulative
  const avgDay = (totalWeek / Math.max(1, weekHours.filter(h => h > 0).length)).toFixed(1);

  // Recent activity for this worker
  const activities = [
    { date: "2026-05-06", obj: 75, hours: 7.5, summary: "EP02 ieklāšana · 45 m²", type: "work" },
    { date: "2026-05-05", obj: 75, hours: 8.5, summary: "Slīpēšana + EP22 · 80 m²", type: "work" },
    { date: "2026-05-04", obj: 76, hours: 9, summary: "Lakas klājums · 30 m²", type: "work" },
    { date: "2026-05-01", obj: null, hours: 0, summary: "Brīvdiena · Darba svētki", type: "holiday" },
    { date: "2026-04-30", obj: 87, hours: 8, summary: "Pabeigts — finiš pārbaude", type: "complete" },
    { date: "2026-04-29", obj: 87, hours: 9, summary: "Kvarca beršana · 40 m²", type: "work" },
  ];

  // Filter activities by selected user (mock — same data for all for demo)
  const objects = D.objects.filter(o =>
    D.events.some(e => e.objectId === o.id && e.workers.includes(target.initials))
  );
  const allObjectIds = [...new Set(D.events.filter(e => e.workers.includes(target.initials)).map(e => e.objectId))];
  const objsAssigned = D.objects.filter(o => allObjectIds.includes(o.id));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          {!isSelf && (
            <button className="back-link" onClick={onBack}>
              <Icon name="chevronLeft" size={13} /> Atpakaļ uz lietotājiem
            </button>
          )}
          <div className="page-eyebrow">{isSelf ? "MANS PROFILS" : "DARBINIEKA KARTĪTE"}</div>
          <h1 className="page-title">{target.name}</h1>
        </div>
      </header>

      <section className="profile-head-card">
        <div className="profile-avatar-lg">{target.initials}</div>
        <div>
          <div className="profile-name">{target.name}</div>
          <div className="profile-meta">
            <span className="profile-meta-item">
              <Icon name="mail" size={12} /> {target.email}
            </span>
            <span className="profile-meta-item">
              <span className={`role-pill ${target.role === "ADMINISTRATORS" ? "role-admin" : "role-worker"}`}>{target.role}</span>
            </span>
            <span className="profile-meta-item">
              <Icon name="folder" size={12} /> {objsAssigned.length} aktīvi objekti
            </span>
          </div>
        </div>
        <div className="page-actions">
          {isAdmin && !isSelf && (
            <>
              <button className="btn btn-ghost"><Icon name="edit" size={15} /> Rediģēt</button>
              <button className="btn btn-outline"><Icon name="mail" size={15} /> Sūtīt e-pastu</button>
            </>
          )}
          {isSelf && (
            <button className="btn btn-outline"><Icon name="settings" size={15} /> Iestatījumi</button>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Nostrādātās stundas</h2>
          <div className="month-toggle">
            <button className={period === "week" ? "on" : ""} onClick={() => setPeriod("week")}>Šī nedēļa</button>
            <button className={period === "month" ? "on" : ""} onClick={() => setPeriod("month")}>Maijs</button>
            <button className={period === "year" ? "on" : ""} onClick={() => setPeriod("year")}>2026</button>
          </div>
        </div>

        <div className="hours-grid">
          {WeekDaysShort.map((day, i) => {
            const h = weekHours[i];
            const isToday = i === today;
            const isWeekend = i >= 5;
            const dayNum = 4 + i;
            const isHoliday = dayNum === 4; // May 4 holiday
            const max = 10;
            const fillPct = Math.min(100, (h / max) * 100);
            const fillClass = h > 9 ? "warn" : h > 10 ? "over" : "";
            return (
              <div key={i} className={`hours-day ${isToday ? "today" : ""} ${isWeekend ? "weekend" : ""}`}>
                <div className="hours-day-name">{day}</div>
                <div className="hours-day-num">05-{String(dayNum).padStart(2, "0")}</div>
                <div className={`hours-day-val ${h === 0 ? "zero" : ""}`}>
                  {h === 0 ? "—" : h.toFixed(1)}
                </div>
                <div className="hours-day-bar">
                  <div className={`hours-day-bar-fill ${fillClass}`} style={{ width: fillPct + "%" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="hours-summary">
          <div className="hours-summary-stat">
            <div className="hours-summary-label">Šonedēļ</div>
            <div className="hours-summary-val">{totalWeek.toFixed(1)}<span className="hours-summary-unit">h</span></div>
          </div>
          <div className="hours-summary-stat">
            <div className="hours-summary-label">Vidēji dienā</div>
            <div className="hours-summary-val">{avgDay}<span className="hours-summary-unit">h</span></div>
          </div>
          <div className="hours-summary-stat">
            <div className="hours-summary-label">Šomēnes</div>
            <div className="hours-summary-val">{totalMonth}<span className="hours-summary-unit">h</span></div>
          </div>
          <div className="hours-summary-stat">
            <div className="hours-summary-label">Šogad</div>
            <div className="hours-summary-val">{totalYear}<span className="hours-summary-unit">h</span></div>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Pēdējie ieraksti</h2>
            <button className="link">Viss žurnāls →</button>
          </div>
          <div className="activity-list">
            {activities.map((a, i) => {
              const obj = a.obj ? D.objects.find(o => o.id === a.obj) : null;
              return (
                <div key={i} className="activity-row">
                  <div className="activity-date">{a.date}</div>
                  <div>
                    <div className="activity-title">
                      {obj ? <span><span className="mono small muted">#{obj.id}</span> {obj.client}</span> : a.summary.split(" · ")[0]}
                    </div>
                    <div className="activity-sub">{obj ? a.summary : a.summary.split(" · ")[1] || a.summary}</div>
                  </div>
                  <div className="activity-hours mono">
                    {a.hours > 0 ? `${a.hours}h` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Piesaistītie objekti</h2>
            <span className="badge">{objsAssigned.length}</span>
          </div>
          <div className="obj-list">
            {objsAssigned.length === 0 && (
              <div className="muted small ta-c" style={{padding: 20}}>Šobrīd nav piesaistītu objektu.</div>
            )}
            {objsAssigned.map(o => {
              const pct = Math.round((o.doneM2 / o.totalM2) * 100);
              return (
                <button key={o.id} className="obj-row" style={{textAlign: "left", width: "100%", background: "none", border: 0, padding: "12px 0", cursor: "pointer"}} onClick={() => onSelectObject && onSelectObject(o.id)}>
                  <div className="obj-row-head">
                    <span className="obj-dot" style={{ background: o.color }} />
                    <span className="obj-id mono">#{o.id}</span>
                    <span className="obj-name">{o.client}</span>
                    <span className="obj-pct mono">{pct}%</span>
                  </div>
                  <div className="bar"><div className="bar-fill" style={{ width: pct + "%", background: o.color }} /></div>
                  <div className="obj-row-meta">
                    <span>{o.system}</span>
                    <span className="mono">{o.doneM2} / {o.totalM2} m²</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

window.WorkerProfile = WorkerProfile;
