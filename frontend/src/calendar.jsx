import { useEffect, useMemo, useState } from "react";
import Icon from "./icons";
import CalendarSettingsModal from "./calendar-settings";
import SearchableSelect from "./search-select";
import {
  addDays,
  holidayName,
  isOffDay,
  loadCalSettings,
  nextWorkday,
  saveCalSettings,
  ymd,
} from "./cal-settings";
import { createJob, fetchJobs, fetchProjects, fetchUsers } from "./api";
import { useI18n } from "./i18n";

const PALETTE = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];

const hashHue = (s) => {
  let h = 0;
  for (let i = 0; i < String(s || "").length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

const jobColor = (job, colorBy) => {
  if (colorBy === "worker") return PALETTE[(job.assigned_to?.id || 0) % PALETTE.length];
  if (colorBy === "system") return hashHue(job.project?.system || job.project?.name);
  return job.project?.color || PALETTE[(job.project?.id || job.id) % PALETTE.length];
};

const jobDay = (iso) => ymd(new Date(iso));

const jobCovers = (job, ds) => {
  const start = jobDay(job.starts_at);
  const end = job.ends_at ? jobDay(job.ends_at) : start;
  return ds >= start && ds <= end;
};

const formatTime = (iso, locale) =>
  new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

const formatWhen = (iso, locale) => {
  const d = new Date(iso);
  return `${ymd(d)} ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
};

const buildMonthGrid = (year, month, firstDay) => {
  const first = new Date(year, month, 1);
  const startOffset = firstDay === "sunday" ? first.getDay() : (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

const CalendarView = ({ user }) => {
  const { t, dateLocale } = useI18n();
  const isAdmin = user.role === "ADMINISTRATORS";
  const [settings, setSettings] = useState(loadCalSettings);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [filterBy, setFilterBy] = useState("workers");
  const [filterId, setFilterId] = useState(user.id);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date();
  const todayStr = ymd(today);
  const grid = buildMonthGrid(year, month, settings.firstDay);
  const dayLabels = useMemo(() => {
    const labels = t("daysShort");
    return settings.firstDay === "sunday" ? [labels[6], ...labels.slice(0, 6)] : labels;
  }, [t, settings.firstDay]);

  const load = async () => {
    const [jobRows, projectRows, people] = await Promise.all([
      fetchJobs(),
      fetchProjects(),
      fetchUsers().catch(() => []),
    ]);
    setJobs(jobRows);
    setProjects(projectRows);
    setUsers((Array.isArray(people) ? people : []).filter((u) => u.is_active !== false));
  };

  useEffect(() => {
    load()
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const visibleJobs = useMemo(() => {
    if (filterBy === "workers") {
      if (filterId === "all") return jobs;
      return jobs.filter((j) => String(j.assigned_to?.id) === String(filterId));
    }
    if (filterId === "all") return jobs;
    return jobs.filter((j) => String(j.id) === String(filterId));
  }, [jobs, filterBy, filterId]);

  const jobsOn = (d) => visibleJobs.filter((j) => jobCovers(j, ymd(d)));

  const workerOptions = useMemo(() => {
    const people = users.length ? users : [user];
    return [
      { id: "all", label: t("calendar.allWorkers") },
      ...people.map((u) => ({
        id: u.id,
        label: u.name,
        sub: u.initials,
      })),
    ];
  }, [users, user, t]);

  const jobOptions = useMemo(
    () => [
      { id: "all", label: t("calendar.allJobs") },
      ...jobs.map((j) => ({
        id: j.id,
        label: j.project?.name || `#${j.id}`,
        sub: `${formatWhen(j.starts_at, dateLocale)} · ${j.assigned_to?.initials || ""}`,
      })),
    ],
    [jobs, t, dateLocale]
  );

  const legend = useMemo(() => {
    const seen = new Map();
    visibleJobs.forEach((j) => {
      if (settings.colorBy === "worker") {
        const id = j.assigned_to?.id;
        if (id && !seen.has(`w-${id}`)) seen.set(`w-${id}`, { key: `w-${id}`, label: j.assigned_to.name, job: j });
      } else if (settings.colorBy === "system") {
        const sys = j.project?.system || j.project?.name;
        if (sys && !seen.has(`s-${sys}`)) seen.set(`s-${sys}`, { key: `s-${sys}`, label: sys, job: j });
      } else if (j.project && !seen.has(`p-${j.project.id}`)) {
        seen.set(`p-${j.project.id}`, { key: `p-${j.project.id}`, label: j.project.name, job: j });
      }
    });
    return [...seen.values()].slice(0, 8);
  }, [visibleJobs, settings.colorBy]);

  const setFilterMode = (mode) => {
    setFilterBy(mode);
    setFilterId(mode === "workers" ? user.id : "all");
  };

  const openAdd = (date) => {
    setSelectedDate(date || ymd(today));
    setShowAdd(true);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("calendar.eyebrow")}</div>
          <h1 className="page-title">{t("calendar.title")}</h1>
          <p className="page-sub">{t("calendar.sub")}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => setShowSettings(true)}>
            <Icon name="settings" size={15} /> {t("calendar.settings")}
          </button>
          <button className="btn btn-primary" onClick={() => openAdd(null)}>
            <Icon name="plus" size={15} /> {t("calendar.newEntry")}
          </button>
        </div>
      </header>

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <Icon name="chevronLeft" size={16} />
          </button>
          <div className="cal-title">
            {t("months")[month]} <span className="mono muted">{year}</span>
          </div>
          <button className="icon-btn" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <Icon name="chevronRight" size={16} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            {t("calendar.today")}
          </button>
        </div>
        <div className="cal-filter">
          <div className="seg">
            <button
              className={`seg-btn ${filterBy === "jobs" ? "on" : ""}`}
              onClick={() => setFilterMode("jobs")}
            >
              {t("calendar.filterJobs")}
            </button>
            <button
              className={`seg-btn ${filterBy === "workers" ? "on" : ""}`}
              onClick={() => setFilterMode("workers")}
            >
              {t("calendar.filterWorkers")}
            </button>
          </div>
          <SearchableSelect
            options={filterBy === "jobs" ? jobOptions : workerOptions}
            value={filterId}
            onChange={setFilterId}
            placeholder={filterBy === "jobs" ? t("calendar.searchJobs") : t("calendar.searchWorkers")}
          />
        </div>
      </div>

      {legend.length > 0 && (
        <div className="cal-legend">
          {legend.map((item) => (
            <div key={item.key} className="legend-pill">
              <span className="dot" style={{ background: jobColor(item.job, settings.colorBy) }} />
              {item.label}
            </div>
          ))}
        </div>
      )}

      {err && <div className="login-err" style={{ marginBottom: 12 }}>{err}</div>}

      <div className="cal-grid">
        <div className="cal-head-row">
          {dayLabels.map((d, i) => (
            <div key={i} className="cal-head-cell">{d}</div>
          ))}
        </div>
        <div className="cal-body">
          {grid.map((d, i) => {
            const inMonth = d.getMonth() === month;
            const ds = ymd(d);
            const isToday = ds === todayStr;
            const off = isOffDay(ds, settings);
            const holiday = holidayName(ds, settings);
            const evs = jobsOn(d);
            const display = evs.slice(0, 3);
            const more = evs.length - display.length;
            return (
              <div
                key={i}
                className={`cal-cell ${!inMonth ? "out" : ""} ${isToday ? "today" : ""} ${off ? "weekend" : ""} ${holiday ? "holiday" : ""}`}
              >
                <div className="cal-cell-head">
                  <span className={`cal-num mono ${isToday ? "today-pill" : ""}`}>{d.getDate()}</span>
                  {holiday && (
                    <span className="cal-flag" title={holiday}>
                      {t("calendar.holiday")}
                    </span>
                  )}
                  {inMonth && (
                    <button className="cal-add" onClick={() => openAdd(ds)}>
                      <Icon name="plus" size={11} />
                    </button>
                  )}
                </div>
                <div className="cal-events">
                  {display.map((job) => (
                    <div key={job.id} className="cal-event" style={{ background: jobColor(job, settings.colorBy) }}>
                      <span className="cal-event-workers mono">
                        {job.ends_at
                          ? `${formatTime(job.starts_at, dateLocale)}–${formatTime(job.ends_at, dateLocale)}`
                          : formatTime(job.starts_at, dateLocale)}
                        {settings.showInitials && job.assigned_to?.initials ? ` · ${job.assigned_to.initials}` : ""}
                      </span>
                      <span className="cal-event-title">{job.project?.name}</span>
                      <span className="cal-event-sys">{job.project?.system || job.project?.client || job.project?.address}</span>
                    </div>
                  ))}
                  {more > 0 && <div className="cal-more">{t("calendar.more", { n: more })}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!loading && visibleJobs.length === 0 && (
        <p className="muted small" style={{ marginTop: 12 }}>{t("calendar.noJobs")}</p>
      )}

      {showAdd && (
        <AddJobModal
          user={user}
          isAdmin={isAdmin}
          projects={projects}
          users={users}
          jobs={jobs}
          settings={settings}
          initialDate={selectedDate}
          initialWorkerId={filterBy === "workers" && filterId !== "all" ? filterId : user.id}
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await load();
            showToast(t("calendar.created"));
          }}
        />
      )}
      {showSettings && (
        <CalendarSettingsModal
          initial={settings}
          onClose={() => setShowSettings(false)}
          onSave={(next) => {
            setSettings(saveCalSettings(next));
            setShowSettings(false);
            showToast(t("calSettings.saved"));
          }}
        />
      )}
      {toast && (
        <div className="toast">
          <Icon name="check" size={14} /> {toast}
        </div>
      )}
    </div>
  );
};

const AddJobModal = ({ user, isAdmin, projects, users, jobs, settings, initialDate, initialWorkerId, onClose, onCreated }) => {
  const { t } = useI18n();
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [date, setDate] = useState(initialDate || ymd(new Date()));
  const [endDate, setEndDate] = useState(initialDate || ymd(new Date()));
  const [time, setTime] = useState(settings.workStart || "08:00");
  const [endTime, setEndTime] = useState(settings.workEnd || "17:00");
  const [assignedTo, setAssignedTo] = useState(initialWorkerId || user.id);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const projectOptions = projects.map((p) => ({
    id: p.id,
    label: p.name,
    sub: [p.client, p.assigned_to?.name].filter(Boolean).join(" · "),
  }));

  const workerOptions = users.map((u) => ({
    id: u.id,
    label: u.name,
    sub: u.initials,
  }));

  const submit = async (e) => {
    e.preventDefault();
    if (!projectId || !date || !time) {
      setErr(t("calendar.fillRequired"));
      return;
    }
    let startDate = date;
    let finishDate = endDate && endDate >= date ? endDate : date;
    if (settings.autoShift) {
      startDate = nextWorkday(startDate, settings);
      finishDate = nextWorkday(finishDate, settings);
      if (finishDate < startDate) finishDate = startDate;
    }
    const offDays = [];
    for (let d = startDate; d <= finishDate; d = addDays(d, 1)) {
      if (isOffDay(d, settings)) offDays.push(d);
      if (d === finishDate) break;
    }
    if (settings.warnHoliday && offDays.length && !settings.autoShift) {
      if (!confirm(t("calendar.holidayConfirm", { dates: offDays.join(", ") }))) return;
    }
    const startIso = new Date(`${startDate}T${time}:00`);
    const finishIso = new Date(`${finishDate}T${endTime || settings.workEnd || "17:00"}:00`);
    if (finishIso < startIso) {
      setErr(t("calendar.endBeforeStart"));
      return;
    }
    const workerId = Number(isAdmin ? assignedTo : user.id);
    if (!settings.allowOverlap) {
      const clash = jobs.some((job) => {
        if (Number(job.assigned_to?.id) !== workerId) return false;
        const bStart = new Date(job.starts_at);
        const bEnd = job.ends_at ? new Date(job.ends_at) : new Date(bStart.getTime() + 8 * 3600000);
        return rangesOverlap(startIso, finishIso, bStart, bEnd);
      });
      if (clash) {
        setErr(t("calendar.overlap"));
        return;
      }
    }
    setBusy(true);
    setErr("");
    try {
      const payload = {
        project_id: Number(projectId),
        assigned_to_id: workerId,
        starts_at: `${startDate}T${time}:00`,
        ends_at: `${finishDate}T${endTime || settings.workEnd || "17:00"}:00`,
      };
      await createJob(payload);
      await onCreated();
    } catch (error) {
      setErr(error.message || t("common.saveFailed"));
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal modal-dropdown" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">{t("calendar.addEyebrow")}</div>
            <h3 className="modal-title">{t("calendar.addTitle")}</h3>
          </div>
          <button className="icon-btn" type="button" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="modal-body">
            {projects.length === 0 ? (
              <div className="muted">{t("calendar.noProjects")}</div>
            ) : (
              <>
                <label className="field">
                  <span className="field-label">{t("calendar.project")}</span>
                  <SearchableSelect
                    options={projectOptions}
                    value={projectId}
                    onChange={setProjectId}
                    placeholder={t("calendar.pickProject")}
                  />
                </label>
                <div className="field-row two">
                  <label className="field">
                    <span className="field-label">{t("calendar.dateFrom")}</span>
                    <input type="date" value={date} onChange={(e) => {
                      setDate(e.target.value);
                      if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                    }} className="input" />
                  </label>
                  <label className="field">
                    <span className="field-label">{t("calendar.dateTo")}</span>
                    <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} className="input" />
                  </label>
                </div>
                <div className="field-row two">
                  <label className="field">
                    <span className="field-label">{t("calendar.time")}</span>
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
                  </label>
                  <label className="field">
                    <span className="field-label">{t("calendar.timeEnd")}</span>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
                  </label>
                </div>
                {isAdmin && (
                  <label className="field">
                    <span className="field-label">{t("calendar.assignee")}</span>
                    <SearchableSelect
                      options={workerOptions}
                      value={assignedTo}
                      onChange={setAssignedTo}
                      placeholder={t("calendar.searchWorkers")}
                    />
                  </label>
                )}
              </>
            )}
            {err && <div className="login-err">{err}</div>}
          </div>
          <footer className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={busy || projects.length === 0}>
              <Icon name="save" size={15} /> {busy ? t("common.saving") : t("calendar.saveEntry")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CalendarView;
