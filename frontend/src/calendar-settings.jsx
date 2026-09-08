import { useState } from "react";
import Icon from "./icons";
import { WEEKDAY_KEYS, workHoursLength } from "./cal-settings";
import { useI18n } from "./i18n";

const CalendarSettingsModal = ({ initial, onClose, onSave }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState("holidays");
  const [holidays, setHolidays] = useState(initial.holidays || []);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");

  const [weekend, setWeekend] = useState(initial.weekend || ["S", "Sv"]);
  const [workStart, setWorkStart] = useState(initial.workStart || "08:00");
  const [workEnd, setWorkEnd] = useState(initial.workEnd || "17:00");
  const [breakMin, setBreakMin] = useState(initial.breakMin ?? 60);

  const [autoShift, setAutoShift] = useState(!!initial.autoShift);
  const [warnHoliday, setWarnHoliday] = useState(!!initial.warnHoliday);
  const [allowOverlap, setAllowOverlap] = useState(!!initial.allowOverlap);
  const [confirmDelete, setConfirmDelete] = useState(!!initial.confirmDelete);

  const [firstDay, setFirstDay] = useState(initial.firstDay || "monday");
  const [colorBy, setColorBy] = useState(initial.colorBy || "object");
  const [showInitials, setShowInitials] = useState(initial.showInitials !== false);

  const addHoliday = () => {
    if (!newDate || !newName.trim()) return;
    setHolidays(
      [...holidays.filter((h) => h.date !== newDate), { date: newDate, name: newName.trim() }].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    );
    setNewDate("");
    setNewName("");
  };
  const removeHoliday = (date) => setHolidays(holidays.filter((h) => h.date !== date));
  const toggleWeekend = (key) =>
    setWeekend(weekend.includes(key) ? weekend.filter((x) => x !== key) : [...weekend, key]);

  const snapshot = () => ({
    holidays,
    weekend,
    workStart,
    workEnd,
    breakMin,
    autoShift,
    warnHoliday,
    allowOverlap,
    confirmDelete,
    firstDay,
    colorBy,
    showInitials,
  });

  const tabs = [
    { id: "holidays", label: t("calSettings.tabHolidays"), icon: "calendar" },
    { id: "hours", label: t("calSettings.tabHours"), icon: "clock" },
    { id: "rules", label: t("calSettings.tabRules"), icon: "shield" },
    { id: "view", label: t("calSettings.tabView"), icon: "settings" },
  ];

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal modal-wide settings-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">{t("calSettings.eyebrow")}</div>
            <h3 className="modal-title">{t("calSettings.title")}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>

        <div className="settings-body">
          <nav className="settings-tabs">
            {tabs.map((item) => (
              <button key={item.id} className={`settings-tab ${tab === item.id ? "on" : ""}`} onClick={() => setTab(item.id)}>
                <Icon name={item.icon} size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="settings-pane">
            {tab === "holidays" && (
              <>
                <div className="set-section">
                  <div className="set-section-title">{t("calSettings.lvHolidays")}</div>
                  <div className="set-section-sub">{t("calSettings.lvHolidaysSub")}</div>
                  <div className="holiday-list">
                    {holidays.map((h) => (
                      <div key={h.date} className="holiday-row">
                        <span className="mono small holiday-date">{h.date}</span>
                        <span className="holiday-name">{h.name}</span>
                        <button className="icon-btn sm danger" onClick={() => removeHoliday(h.date)}><Icon name="trash" size={12} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="holiday-add">
                    <input type="date" className="input input-sm" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    <input type="text" className="input input-sm" placeholder={t("calSettings.holidayName")} value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <button className="btn btn-outline btn-sm" onClick={addHoliday}><Icon name="plus" size={13} /> {t("common.add")}</button>
                  </div>
                </div>

                <div className="set-section">
                  <div className="set-section-title">{t("calSettings.weekend")}</div>
                  <div className="set-section-sub">{t("calSettings.weekendSub")}</div>
                  <div className="weekday-row">
                    {WEEKDAY_KEYS.map((key, i) => (
                      <button key={key} className={`weekday-btn ${weekend.includes(key) ? "on" : ""}`} onClick={() => toggleWeekend(key)}>
                        <span className="mono">{t("daysShort")[i]}</span>
                        <span className="weekday-label">{t("weekdays")[i]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === "hours" && (
              <>
                <div className="set-section">
                  <div className="set-section-title">{t("calSettings.workHours")}</div>
                  <div className="set-section-sub">{t("calSettings.workHoursSub")}</div>
                  <div className="field-row">
                    <label className="field"><span className="field-label">{t("calSettings.start")}</span><input type="time" className="input mono" value={workStart} onChange={(e) => setWorkStart(e.target.value)} /></label>
                    <label className="field"><span className="field-label">{t("calSettings.end")}</span><input type="time" className="input mono" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} /></label>
                    <label className="field"><span className="field-label">{t("calSettings.breakMin")}</span><input type="number" className="input mono" value={breakMin} onChange={(e) => setBreakMin(+e.target.value || 0)} /></label>
                  </div>
                  <div className="info-strip">
                    <Icon name="clock" size={14} />
                    <span>{t("calSettings.workLength")} <strong className="mono">{workHoursLength({ workStart, workEnd, breakMin })} h</strong></span>
                  </div>
                </div>
              </>
            )}

            {tab === "rules" && (
              <div className="set-section">
                <div className="set-section-title">{t("calSettings.autoTitle")}</div>
                <div className="set-section-sub">{t("calSettings.autoSub")}</div>
                <div className="rule-list">
                  <ToggleRow on={autoShift} setOn={setAutoShift} label={t("calSettings.autoShift")} sub={t("calSettings.autoShiftSub")} />
                  <ToggleRow on={warnHoliday} setOn={setWarnHoliday} label={t("calSettings.warnHoliday")} sub={t("calSettings.warnHolidaySub")} />
                  <ToggleRow on={allowOverlap} setOn={setAllowOverlap} label={t("calSettings.allowOverlap")} sub={t("calSettings.allowOverlapSub")} />
                  <ToggleRow on={confirmDelete} setOn={setConfirmDelete} label={t("calSettings.confirmDelete")} sub={t("calSettings.confirmDeleteSub")} />
                </div>
              </div>
            )}

            {tab === "view" && (
              <>
                <div className="set-section">
                  <div className="set-section-title">{t("calSettings.weekStart")}</div>
                  <div className="seg">
                    {[["monday", t("calSettings.monday")], ["sunday", t("calSettings.sunday")]].map(([k, l]) => (
                      <button key={k} className={`seg-btn ${firstDay === k ? "on" : ""}`} onClick={() => setFirstDay(k)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="set-section">
                  <div className="set-section-title">{t("calSettings.colorBy")}</div>
                  <div className="seg">
                    {[["object", t("calSettings.byObject")], ["worker", t("calSettings.byWorker")], ["system", t("calSettings.bySystem")]].map(([k, l]) => (
                      <button key={k} className={`seg-btn ${colorBy === k ? "on" : ""}`} onClick={() => setColorBy(k)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="set-section">
                  <ToggleRow on={showInitials} setOn={setShowInitials} label={t("calSettings.showInitials")} sub={t("calSettings.showInitialsSub")} />
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="modal-foot">
          <div className="muted small">{t("calSettings.appliesAll")}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button className="btn btn-primary" onClick={() => onSave(snapshot())}><Icon name="save" size={15} /> {t("calSettings.save")}</button>
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

export default CalendarSettingsModal;
