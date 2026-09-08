// Calendar view (month grid) + Add Event modal
const DAYS_LV = ["P", "O", "T", "C", "Pk", "S", "Sv"];
const MONTHS_LV = ["Janvāris", "Februāris", "Marts", "Aprīlis", "Maijs", "Jūnijs", "Jūlijs", "Augusts", "Septembris", "Oktobris", "Novembris", "Decembris"];

const fmt = d => {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const buildMonthGrid = (year, month) => {
  // Monday first
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = Mon
  const start = new Date(year, month, 1 - startOffset);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
};

const CalendarView = ({ user, onSelectObject }) => {
  const D = window.PROCOAT_DATA;
  const isAdmin = user.role === "ADMINISTRATORS";
  const [cursor, setCursor] = React.useState(new Date(2026, 4, 1));
  const [showAdd, setShowAdd] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date(2026, 4, 6);
  const todayStr = fmt(today);
  const grid = buildMonthGrid(year, month);

  const eventsOn = (d) => {
    const ds = fmt(d);
    return D.events.filter(e => ds >= e.start && ds <= e.end);
  };

  const isHoliday = (d) => D.holidays2026.some(h => h.date === fmt(d));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">PLĀNOJUMS</div>
          <h1 className="page-title">Kalendārs</h1>
          <p className="page-sub">Visi būvobjekti, darbinieku piesaiste un periodi.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => setShowSettings(true)}><Icon name="settings" size={15} /> Iestatījumi</button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => { setSelectedDate(null); setShowAdd(true); }}>
              <Icon name="plus" size={15} /> Jauns ieraksts
            </button>
          )}
        </div>
      </header>

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => setCursor(new Date(year, month - 1, 1))}><Icon name="chevronLeft" size={16} /></button>
          <div className="cal-title">{MONTHS_LV[month]} <span className="mono muted">{year}</span></div>
          <button className="icon-btn" onClick={() => setCursor(new Date(year, month + 1, 1))}><Icon name="chevronRight" size={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCursor(new Date(2026, 4, 1))}>Šodien</button>
        </div>
        <div className="cal-legend">
          {D.objects.slice(0, 5).map(o => (
            <div key={o.id} className="legend-pill">
              <span className="dot" style={{ background: o.color }} />
              <span className="mono">#{o.id}</span> {o.client}
            </div>
          ))}
        </div>
      </div>

      <div className="cal-grid">
        <div className="cal-head-row">
          {DAYS_LV.map(d => <div key={d} className="cal-head-cell">{d}</div>)}
        </div>
        <div className="cal-body">
          {grid.map((d, i) => {
            const inMonth = d.getMonth() === month;
            const ds = fmt(d);
            const isToday = ds === todayStr;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const holiday = isHoliday(d);
            const evs = eventsOn(d);
            const display = evs.slice(0, 3);
            const more = evs.length - display.length;
            return (
              <div key={i} className={`cal-cell ${!inMonth ? "out" : ""} ${isToday ? "today" : ""} ${isWeekend ? "weekend" : ""} ${holiday ? "holiday" : ""}`}>
                <div className="cal-cell-head">
                  <span className={`cal-num mono ${isToday ? "today-pill" : ""}`}>{d.getDate()}</span>
                  {holiday && <span className="cal-flag" title={D.holidays2026.find(h=>h.date===ds)?.name}>svētki</span>}
                  {isAdmin && inMonth && (
                    <button className="cal-add" onClick={() => { setSelectedDate(ds); setShowAdd(true); }}><Icon name="plus" size={11} /></button>
                  )}
                </div>
                <div className="cal-events">
                  {display.map(e => {
                    const obj = D.objects.find(o => o.id === e.objectId);
                    return (
                      <button key={e.id} className="cal-event" style={{ background: e.color }} onClick={() => onSelectObject && onSelectObject(obj)}>
                        <span className="cal-event-workers mono">{e.workers.join("·")}</span>
                        <span className="cal-event-title">{e.title}</span>
                        <span className="cal-event-sys">{e.system}</span>
                      </button>
                    );
                  })}
                  {more > 0 && <button className="cal-more">+{more} vairāk</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showAdd && <AddEventModal onClose={() => setShowAdd(false)} initialDate={selectedDate} />}
      {showSettings && <CalendarSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

const AddEventModal = ({ onClose, initialDate }) => {
  const D = window.PROCOAT_DATA;
  const [objectId, setObjectId] = React.useState(D.objects[0].id);
  const [from, setFrom] = React.useState(initialDate || "2026-05-12");
  const [to, setTo] = React.useState(initialDate || "2026-05-15");
  const [workers, setWorkers] = React.useState(["AK"]);
  const [color, setColor] = React.useState("#2C5F2E");
  const [recur, setRecur] = React.useState("once");
  const [skipHolidays, setSkipHolidays] = React.useState(true);
  const [overrideHoliday, setOverrideHoliday] = React.useState(false);

  const palette = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];

  const dayCount = React.useMemo(() => {
    const a = new Date(from), b = new Date(to);
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }, [from, to]);

  const toggleWorker = (i) => setWorkers(w => w.includes(i) ? w.filter(x => x !== i) : [...w, i]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">JAUNS KALENDĀRA IERAKSTS</div>
            <h3 className="modal-title">Pievienot objekta darbus</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>

        <div className="modal-body">
          <label className="field">
            <span className="field-label">Objekts</span>
            <select value={objectId} onChange={e => setObjectId(+e.target.value)} className="select">
              {D.objects.map(o => (
                <option key={o.id} value={o.id}>#{o.id} — {o.client}, {o.address.split(",")[0]}</option>
              ))}
            </select>
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Datums no</span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input" />
            </label>
            <label className="field">
              <span className="field-label">Datums līdz</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input" />
            </label>
            <div className="field">
              <span className="field-label">Dienas</span>
              <div className="readout mono">{dayCount}</div>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Darbinieki</span>
            <div className="worker-grid">
              {D.users.map(u => (
                <button key={u.id} type="button"
                  className={`worker-chip ${workers.includes(u.initials) ? "on" : ""}`}
                  onClick={() => toggleWorker(u.initials)}>
                  <span className="avatar xs">{u.initials}</span>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Krāsa kalendārā</span>
            <div className="color-row">
              {palette.map(c => (
                <button key={c} type="button" className={`color-dot ${color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Atkārtošanās</span>
            <div className="seg">
              {[["once", "Vienreizējs"], ["repeat", "Atkārtojas"], ["split", "Sadalīts pa periodiem"]].map(([k, l]) => (
                <button key={k} className={`seg-btn ${recur === k ? "on" : ""}`} onClick={() => setRecur(k)}>{l}</button>
              ))}
            </div>
          </div>

          <div className="check-stack">
            <label className="check"><input type="checkbox" checked={skipHolidays} onChange={e => setSkipHolidays(e.target.checked)} /> Pārcelt uz nākamo darba dienu, ja krīt brīvdienā</label>
            <label className="check"><input type="checkbox" checked={overrideHoliday} onChange={e => setOverrideHoliday(e.target.checked)} /> Strādā arī brīvdienā (izņēmums)</label>
          </div>
        </div>

        <footer className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Atcelt</button>
          <button className="btn btn-primary" onClick={onClose}><Icon name="save" size={15} /> Saglabāt ierakstu</button>
        </footer>
      </div>
    </div>
  );
};

window.CalendarView = CalendarView;
