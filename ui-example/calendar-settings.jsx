// Calendar Settings modal
const CalendarSettingsModal = ({ onClose }) => {
  const D = window.PROCOAT_DATA;
  const [tab, setTab] = React.useState("holidays");
  const [holidays, setHolidays] = React.useState(D.holidays2026);
  const [newDate, setNewDate] = React.useState("");
  const [newName, setNewName] = React.useState("");

  const [weekend, setWeekend] = React.useState(["S", "Sv"]);
  const [workStart, setWorkStart] = React.useState("08:00");
  const [workEnd, setWorkEnd] = React.useState("17:00");
  const [breakMin, setBreakMin] = React.useState(60);

  const [autoShift, setAutoShift] = React.useState(true);
  const [warnHoliday, setWarnHoliday] = React.useState(true);
  const [allowOverlap, setAllowOverlap] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(true);

  const [firstDay, setFirstDay] = React.useState("monday");
  const [colorBy, setColorBy] = React.useState("object");
  const [showInitials, setShowInitials] = React.useState(true);

  const addHoliday = () => {
    if (!newDate || !newName.trim()) return;
    setHolidays([...holidays, { date: newDate, name: newName.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate(""); setNewName("");
  };
  const removeHoliday = (date) => setHolidays(holidays.filter(h => h.date !== date));
  const toggleWeekend = (d) => setWeekend(weekend.includes(d) ? weekend.filter(x => x !== d) : [...weekend, d]);

  const tabs = [
    { id: "holidays", label: "Brīvdienas", icon: "calendar" },
    { id: "hours", label: "Darba laiks", icon: "clock" },
    { id: "rules", label: "Noteikumi", icon: "shield" },
    { id: "view", label: "Skats", icon: "settings" },
  ];

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal modal-wide settings-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">KALENDĀRA IESTATĪJUMI</div>
            <h3 className="modal-title">Konfigurēt kalendāra darbību</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>

        <div className="settings-body">
          <nav className="settings-tabs">
            {tabs.map(t => (
              <button key={t.id} className={`settings-tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={15} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="settings-pane">
            {tab === "holidays" && (
              <>
                <div className="set-section">
                  <div className="set-section-title">Latvijas svētki un brīvdienas</div>
                  <div className="set-section-sub">Šajās dienās kalendārā tiks rādīts brīdinājums.</div>
                  <div className="holiday-list">
                    {holidays.map(h => (
                      <div key={h.date} className="holiday-row">
                        <span className="mono small holiday-date">{h.date}</span>
                        <span className="holiday-name">{h.name}</span>
                        <button className="icon-btn sm danger" onClick={() => removeHoliday(h.date)}><Icon name="trash" size={12} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="holiday-add">
                    <input type="date" className="input input-sm" value={newDate} onChange={e => setNewDate(e.target.value)} />
                    <input type="text" className="input input-sm" placeholder="Svētku nosaukums" value={newName} onChange={e => setNewName(e.target.value)} />
                    <button className="btn btn-outline btn-sm" onClick={addHoliday}><Icon name="plus" size={13} /> Pievienot</button>
                  </div>
                </div>

                <div className="set-section">
                  <div className="set-section-title">Nedēļas nogale</div>
                  <div className="set-section-sub">Atzīmē dienas, kuras kalendārā uzskata par brīvdienām.</div>
                  <div className="weekday-row">
                    {[["P", "Pirmd."], ["O", "Otrd."], ["T", "Treš."], ["C", "Ceturt."], ["Pk", "Piekt."], ["S", "Sestd."], ["Sv", "Svētd."]].map(([k, l]) => (
                      <button key={k} className={`weekday-btn ${weekend.includes(k) ? "on" : ""}`} onClick={() => toggleWeekend(k)}>
                        <span className="mono">{k}</span>
                        <span className="weekday-label">{l}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === "hours" && (
              <>
                <div className="set-section">
                  <div className="set-section-title">Standarta darba laiks</div>
                  <div className="set-section-sub">Tiek piedāvāts kā noklusējums jaunos kalendāra ierakstos.</div>
                  <div className="field-row">
                    <label className="field"><span className="field-label">Sākums</span><input type="time" className="input mono" value={workStart} onChange={e => setWorkStart(e.target.value)} /></label>
                    <label className="field"><span className="field-label">Beigas</span><input type="time" className="input mono" value={workEnd} onChange={e => setWorkEnd(e.target.value)} /></label>
                    <label className="field"><span className="field-label">Pārtraukums (min)</span><input type="number" className="input mono" value={breakMin} onChange={e => setBreakMin(+e.target.value || 0)} /></label>
                  </div>
                  <div className="info-strip">
                    <Icon name="clock" size={14} />
                    <span>Aprēķinātais darba dienas garums: <strong className="mono">{Math.round(((parseInt(workEnd) * 60 + parseInt(workEnd.slice(3))) - (parseInt(workStart) * 60 + parseInt(workStart.slice(3))) - breakMin) / 6) / 10} h</strong></span>
                  </div>
                </div>
              </>
            )}

            {tab === "rules" && (
              <div className="set-section">
                <div className="set-section-title">Automātiskā uzvedība</div>
                <div className="set-section-sub">Kā sistēma rīkojas kritiskās situācijās.</div>
                <div className="rule-list">
                  <ToggleRow on={autoShift} setOn={setAutoShift} label="Pārcelt uz nākamo darba dienu" sub="Ja kalendāra ieraksts iekrīt brīvdienā vai svētkos, automātiski pārvieto uz tuvāko darba dienu." />
                  <ToggleRow on={warnHoliday} setOn={setWarnHoliday} label="Brīdināt pirms saglabāšanas svētkos" sub="Pirms saglabāšanas parāda apstiprinājuma logu." />
                  <ToggleRow on={allowOverlap} setOn={setAllowOverlap} label="Atļaut darbinieku pārklāšanos" sub="Viens darbinieks vienlaicīgi var būt nozīmēts vairākos objektos." />
                  <ToggleRow on={confirmDelete} setOn={setConfirmDelete} label="Apstiprinājums pirms dzēšanas" sub="Pieprasīt apstiprinājumu, kad dzēš kalendāra ierakstu." />
                </div>
              </div>
            )}

            {tab === "view" && (
              <>
                <div className="set-section">
                  <div className="set-section-title">Nedēļas sākuma diena</div>
                  <div className="seg">
                    {[["monday", "Pirmdiena"], ["sunday", "Svētdiena"]].map(([k, l]) => (
                      <button key={k} className={`seg-btn ${firstDay === k ? "on" : ""}`} onClick={() => setFirstDay(k)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="set-section">
                  <div className="set-section-title">Notikumu krāsu kodēšana</div>
                  <div className="seg">
                    {[["object", "Pēc objekta"], ["worker", "Pēc darbinieka"], ["system", "Pēc sistēmas"]].map(([k, l]) => (
                      <button key={k} className={`seg-btn ${colorBy === k ? "on" : ""}`} onClick={() => setColorBy(k)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="set-section">
                  <ToggleRow on={showInitials} setOn={setShowInitials} label="Rādīt darbinieku iniciāļus uz kartēm" sub="Piem. AK·KF — palīdz ātri redzēt, kas strādā." />
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="modal-foot">
          <div className="muted small">Iestatījumi attiecas uz visiem lietotājiem.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>Atcelt</button>
            <button className="btn btn-primary" onClick={onClose}><Icon name="save" size={15} /> Saglabāt iestatījumus</button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const ToggleRow = ({ on, setOn, label, sub }) => (
  <div className="toggle-row" onClick={() => setOn(!on)}>
    <div>
      <div className="toggle-label">{label}</div>
      <div className="toggle-sub">{sub}</div>
    </div>
    <button className={`switch ${on ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); setOn(!on); }}>
      <span className="switch-knob" />
    </button>
  </div>
);

window.CalendarSettingsModal = CalendarSettingsModal;
