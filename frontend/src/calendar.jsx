import { useEffect, useMemo, useState } from "react";
import Icon from "./icons";
import CalendarSettingsModal from "./calendar-settings";
import SearchableSelect from "./search-select";
import {
  addDays,
  DEFAULT_CAL_SETTINGS,
  holidayName,
  isOffDay,
  nextWorkday,
  settingsFromApi,
  settingsToApi,
  ymd,
} from "./cal-settings";
import { createJob, fetchCalendarSettings, fetchJobs, fetchProjects, fetchUsers, saveCalendarSettings } from "./api";
import { assigneeNames } from "./assignees";
import { useI18n } from "./i18n";

const PALETTE = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];
const WORKER_PALETTE = [
  "#2C5F2E", "#3D6BA5", "#C45C26", "#6E5B8A", "#1D6A7A",
  "#A63D40", "#3F6F3A", "#B8860B", "#4A6FA5", "#8B4513",
  "#1F7A6C", "#C45C5C", "#264653", "#7B4B94", "#1D7A9C",
  "#8A3B2B",
];

const hashHue = (s) => {
  let h = 0;
  for (let i = 0; i < String(s || "").length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

const projectColor = (project, fallbackId) =>
  project?.color || PALETTE[(project?.id || fallbackId || 0) % PALETTE.length];

const buildWorkerColors = (users, jobs) => {
  const people = new Map();
  (users || []).forEach((person) => people.set(Number(person.id), person));
  (jobs || []).forEach((job) => {
    const person = job.assigned_to;
    if (person?.id && !people.has(Number(person.id))) people.set(Number(person.id), person);
  });
  const sorted = [...people.values()].sort((a, b) => Number(a.id) - Number(b.id));
  const map = new Map();
  sorted.forEach((person, index) => {
    map.set(Number(person.id), WORKER_PALETTE[index % WORKER_PALETTE.length]);
  });
  return map;
};

const groupJobsByProject = (dayJobs) => {
  const groups = new Map();
  dayJobs.forEach((job) => {
    const pid = job.project?.id || `job-${job.id}`;
    if (!groups.has(pid)) {
      groups.set(pid, {
        key: String(pid),
        project: job.project,
        jobs: [],
        workers: [],
      });
    }
    const group = groups.get(pid);
    group.jobs.push(job);
    const worker = job.assigned_to;
    if (worker?.id && !group.workers.some((person) => Number(person.id) === Number(worker.id))) {
      group.workers.push(worker);
    }
  });
  return [...groups.values()];
};

const groupTimeLabel = (group, locale) => {
  const starts = group.jobs.map((job) => new Date(job.starts_at)).sort((a, b) => a - b);
  const ends = group.jobs
    .map((job) => (job.ends_at ? new Date(job.ends_at) : null))
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (!starts.length) return "";
  const start = starts[0].toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (!ends.length) return start;
  const end = ends[ends.length - 1].toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${start}–${end}`;
};

const jobDay = (iso) => ymd(new Date(iso));

const jobCovers = (job, ds) => {
  const start = jobDay(job.starts_at);
  const end = job.ends_at ? jobDay(job.ends_at) : start;
  return ds >= start && ds <= end;
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

const CalendarView = ({ user, onSelectObject }) => {
  const { t, dateLocale } = useI18n();
  const isAdmin = user.role === "ADMINISTRATORS";
  const [settings, setSettings] = useState(DEFAULT_CAL_SETTINGS);
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
  const [projectFilter, setProjectFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState(isAdmin ? "all" : user.id);

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
    const [jobRows, projectRows, people, cal] = await Promise.all([
      fetchJobs(),
      fetchProjects(),
      fetchUsers().catch(() => []),
      fetchCalendarSettings().catch(() => null),
    ]);
    setJobs(jobRows);
    setProjects(projectRows);
    setUsers((Array.isArray(people) ? people : []).filter((u) => u.is_active !== false));
    if (cal) setSettings(settingsFromApi(cal));
  };

  useEffect(() => {
    load()
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const workerColors = useMemo(() => buildWorkerColors(users, jobs), [users, jobs]);
  const colorForWorker = (id) => workerColors.get(Number(id)) || WORKER_PALETTE[0];

  const visibleJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (projectFilter !== "all" && String(job.project?.id) !== String(projectFilter)) return false;
      if (workerFilter !== "all" && String(job.assigned_to?.id) !== String(workerFilter)) return false;
      return true;
    });
  }, [jobs, projectFilter, workerFilter]);

  const groupsOn = (d) => groupJobsByProject(visibleJobs.filter((job) => jobCovers(job, ymd(d))));

  const groupColor = (group) => {
    if (settings.colorBy === "worker" && group.workers.length === 1) {
      return colorForWorker(group.workers[0].id);
    }
    if (settings.colorBy === "system") {
      return hashHue(group.project?.system || group.project?.name);
    }
    return projectColor(group.project, group.jobs[0]?.id);
  };

  const workerOptions = useMemo(() => {
    const people = users.length ? users : [user];
    return [
      { id: "all", label: t("calendar.allWorkers") },
      ...people.map((person) => ({
        id: person.id,
        label: person.name,
        sub: person.initials,
      })),
    ];
  }, [users, user, t]);

  const projectOptions = useMemo(
    () => [
      { id: "all", label: t("calendar.allProjects") },
      ...projects.map((project) => ({
        id: project.id,
        label: project.name,
        sub: [project.client, assigneeNames(project)].filter(Boolean).join(" · "),
      })),
    ],
    [projects, t]
  );

  const legend = useMemo(() => {
    const projectsSeen = [];
    const workersSeen = [];
    const seenP = new Set();
    const seenW = new Set();
    visibleJobs.forEach((job) => {
      const project = job.project;
      if (project?.id && !seenP.has(project.id)) {
        seenP.add(project.id);
        projectsSeen.push({
          key: `p-${project.id}`,
          label: project.name,
          color: projectColor(project, project.id),
        });
      }
      const worker = job.assigned_to;
      if (worker?.id && !seenW.has(worker.id)) {
        seenW.add(worker.id);
        workersSeen.push({
          key: `w-${worker.id}`,
          label: worker.name,
          initials: worker.initials,
          color: colorForWorker(worker.id),
        });
      }
    });
    return {
      projects: projectsSeen.slice(0, 8),
      workers: workersSeen.slice(0, 12),
    };
  }, [visibleJobs, workerColors]);

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
          {isAdmin && (
            <button className="btn btn-ghost" onClick={() => setShowSettings(true)}>
              <Icon name="settings" size={15} /> {t("calendar.settings")}
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => openAdd(null)}>
              <Icon name="plus" size={15} /> {t("calendar.newEntry")}
            </button>
          )}
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
          <label className="cal-filter-field">
            <span className="cal-filter-label">{t("calendar.project")}</span>
            <SearchableSelect
              options={projectOptions}
              value={projectFilter}
              onChange={setProjectFilter}
              placeholder={t("calendar.searchProjects")}
            />
          </label>
          <label className="cal-filter-field">
            <span className="cal-filter-label">{t("calendar.workers")}</span>
            <SearchableSelect
              options={workerOptions}
              value={workerFilter}
              onChange={setWorkerFilter}
              placeholder={t("calendar.searchWorkers")}
            />
          </label>
        </div>
      </div>

      {(legend.projects.length > 0 || legend.workers.length > 0) && (
        <div className="cal-legend">
          {legend.projects.map((item) => (
            <div key={item.key} className="legend-pill">
              <span className="dot" style={{ background: item.color }} />
              {item.label}
            </div>
          ))}
          {legend.workers.map((item) => (
            <div key={item.key} className="legend-pill worker">
              <span className="cal-chip" style={{ background: item.color }}>{item.initials || "?"}</span>
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
            const evs = groupsOn(d);
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
                  {inMonth && isAdmin && (
                    <button className="cal-add" onClick={() => openAdd(ds)}>
                      <Icon name="plus" size={11} />
                    </button>
                  )}
                </div>
                <div className="cal-events">
                  {display.map((group) => {
                    const project = group.project;
                    return (
                      <button
                        key={group.key}
                        type="button"
                        className="cal-event"
                        style={{
                          background: groupColor(group),
                          width: "100%",
                          textAlign: "left",
                          border: 0,
                          cursor: project?.id ? "pointer" : "default",
                        }}
                        onClick={() => project?.id && onSelectObject && onSelectObject(project.id)}
                      >
                        <span className="cal-event-workers mono">{groupTimeLabel(group, dateLocale)}</span>
                        <span className="cal-event-title">{project?.name}</span>
                        {group.workers.length > 0 && (
                          <span className="cal-event-chips">
                            {group.workers.map((person) => (
                              <span
                                key={person.id}
                                className="cal-chip"
                                title={person.name}
                                style={{ background: colorForWorker(person.id) }}
                              >
                                {person.initials || "?"}
                              </span>
                            ))}
                          </span>
                        )}
                        <span className="cal-event-sys">{project?.system || project?.client || project?.address}</span>
                      </button>
                    );
                  })}
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
          initialWorkerId={workerFilter !== "all" ? workerFilter : user.id}
          initialProjectId={projectFilter !== "all" ? projectFilter : undefined}
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
          onSave={async (next) => {
            try {
              const saved = await saveCalendarSettings(settingsToApi(next));
              setSettings(settingsFromApi(saved));
              setShowSettings(false);
              showToast(t("calSettings.saved"));
            } catch (error) {
              showToast(error.message || t("api.saveCalendarSettings"));
            }
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

const AddJobModal = ({ user, isAdmin, projects, users, jobs, settings, initialDate, initialWorkerId, initialProjectId, onClose, onCreated }) => {
  const { t } = useI18n();
  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || "");
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
    sub: [p.client, assigneeNames(p)].filter(Boolean).join(" · "),
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
