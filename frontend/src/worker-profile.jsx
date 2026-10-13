import { useEffect, useMemo, useState } from "react";
import Icon from "./icons";
import { fetchCalendarSettings, fetchJobs, fetchProjects, fetchReports, fetchUsers } from "./api";
import { isAssignedTo } from "./assignees";
import { DEFAULT_CAL_SETTINGS, settingsFromApi, workHoursLength, ymd } from "./cal-settings";
import { STATUS_LABEL, statusClass } from "./projects";
import { useI18n } from "./i18n";
import CsvExportMenu from "./csv-export";
import ReportEntry from "./report-entry";

const mondayOf = (d) => {
  const date = new Date(d);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  date.setHours(12, 0, 0, 0);
  return date;
};

const hoursOnDay = (job, dateStr, defaultH, workStart = "08:00", workEnd = "17:00") => {
  const startDay = ymd(new Date(job.starts_at));
  const endDay = job.ends_at ? ymd(new Date(job.ends_at)) : startDay;
  if (dateStr < startDay || dateStr > endDay) return 0;
  if (startDay === endDay) {
    if (job.ends_at) {
      const h = (new Date(job.ends_at) - new Date(job.starts_at)) / 3600000;
      return Math.max(0, Math.round(h * 10) / 10);
    }
    return defaultH;
  }
  if (dateStr === startDay) {
    const endOfWork = new Date(`${dateStr}T${workEnd}:00`);
    const h = (endOfWork - new Date(job.starts_at)) / 3600000;
    return Math.max(0.5, Math.round(h * 10) / 10);
  }
  if (dateStr === endDay && job.ends_at) {
    const startOfWork = new Date(`${dateStr}T${workStart}:00`);
    const h = (new Date(job.ends_at) - startOfWork) / 3600000;
    return Math.max(0.5, Math.round(h * 10) / 10);
  }
  return defaultH;
};

const WorkerProfile = ({ user, profileUserId, onBack, onSelectObject, onOpenReport }) => {
  const { t } = useI18n();
  const isAdmin = user.role === "ADMINISTRATORS";
  const [period, setPeriod] = useState("week");
  const [target, setTarget] = useState(user);
  const [reports, setReports] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_CAL_SETTINGS);

  const defaultH = workHoursLength(settings) || 8;
  const now = new Date();
  const weekStart = mondayOf(now);
  const todayStr = ymd(now);
  const holidays = settings.holidays || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let people = [];
      try {
        people = await fetchUsers();
      } catch {
        people = [];
      }
      const found = (people || []).find((u) => String(u.id) === String(profileUserId));
      const next = found || (String(user.id) === String(profileUserId) ? user : user);
      if (cancelled) return;
      setTarget(next);
      try {
        const [projects, jobRows, cal, reportRows] = await Promise.all([
          fetchProjects(),
          fetchJobs({ assigned_to: next.id }),
          fetchCalendarSettings().catch(() => null),
          fetchReports({ recorded_by: next.id }).catch(() => []),
        ]);
        if (cancelled) return;
        setReports(Array.isArray(reportRows) ? reportRows : []);
        setAssigned((Array.isArray(projects) ? projects : []).filter((p) => isAssignedTo(p, next.id)));
        setJobs(Array.isArray(jobRows) ? jobRows : []);
        if (cal) setSettings(settingsFromApi(cal));
      } catch {
        if (!cancelled) {
          setReports([]);
          setAssigned([]);
          setJobs([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileUserId, user]);

  const isSelf = String(target.id) === String(user.id);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const ds = ymd(d);
      const hours = jobs.reduce((s, job) => s + hoursOnDay(job, ds, defaultH, settings.workStart, settings.workEnd), 0);
      return {
        date: ds,
        dayNum: d.getDate(),
        month: String(d.getMonth() + 1).padStart(2, "0"),
        hours: Math.round(hours * 10) / 10,
        isToday: ds === todayStr,
        isWeekend: settings.weekend.includes(["P", "O", "T", "C", "Pk", "S", "Sv"][i]),
        isHoliday: holidays.some((h) => h.date === ds),
      };
    });
  }, [jobs, weekStart, defaultH, todayStr, settings.weekend, settings.workStart, settings.workEnd, holidays]);

  const sumHours = (start, end) => {
    let total = 0;
    jobs.forEach((job) => {
      const from = ymd(new Date(job.starts_at));
      const to = job.ends_at ? ymd(new Date(job.ends_at)) : from;
      let d = from < start ? start : from;
      const last = to > end ? end : to;
      while (d <= last) {
        total += hoursOnDay(job, d, defaultH);
        const next = new Date(`${d}T12:00:00`);
        next.setDate(next.getDate() + 1);
        d = ymd(next);
      }
    });
    return Math.round(total * 10) / 10;
  };

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd = `${now.getFullYear()}-12-31`;

  const totalWeek = weekDays.reduce((s, d) => s + d.hours, 0);
  const totalMonth = sumHours(monthStart, monthEnd);
  const totalYear = sumHours(yearStart, yearEnd);
  const workedDays = weekDays.filter((d) => d.hours > 0).length;
  const avgDay = (totalWeek / Math.max(1, workedDays)).toFixed(1);

  const exportRange = useMemo(() => {
    if (period === "week") {
      const end = new Date(weekStart);
      end.setDate(weekStart.getDate() + 6);
      return { from: ymd(weekStart), to: ymd(end) };
    }
    if (period === "year") return { from: yearStart, to: yearEnd };
    return { from: monthStart, to: monthEnd };
  }, [period, weekStart, monthStart, monthEnd, yearStart, yearEnd]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          {!isSelf && (
            <button className="back-link" onClick={onBack}>
              <Icon name="chevronLeft" size={13} /> {t("profile.back")}
            </button>
          )}
          <div className="page-eyebrow">{isSelf ? t("profile.mine") : t("profile.card")}</div>
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
              <Icon name="folder" size={12} /> {t("profile.activeProjects", { n: assigned.length })}
            </span>
          </div>
        </div>
        <div className="page-actions">
          <CsvExportMenu from={exportRange.from} to={exportRange.to} userId={target.id} />
          {isAdmin && !isSelf && (
            <>
              <button className="btn btn-ghost"><Icon name="edit" size={15} /> {t("common.edit")}</button>
              <button className="btn btn-outline"><Icon name="mail" size={15} /> {t("profile.sendEmail")}</button>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{t("profile.hours")}</h2>
          <div className="month-toggle">
            <button className={period === "week" ? "on" : ""} onClick={() => setPeriod("week")}>{t("profile.thisWeek")}</button>
            <button className={period === "month" ? "on" : ""} onClick={() => setPeriod("month")}>{t("months")[now.getMonth()]}</button>
            <button className={period === "year" ? "on" : ""} onClick={() => setPeriod("year")}>{now.getFullYear()}</button>
          </div>
        </div>

        <div className="hours-grid">
          {t("daysShort").map((day, i) => {
            const row = weekDays[i];
            const h = row?.hours || 0;
            const max = 10;
            const fillPct = Math.min(100, (h / max) * 100);
            const fillClass = h > 10 ? "over" : h > 9 ? "warn" : "";
            return (
              <div key={i} className={`hours-day ${row?.isToday ? "today" : ""} ${row?.isWeekend ? "weekend" : ""} ${row?.isHoliday ? "holiday" : ""}`}>
                <div className="hours-day-name">{day}</div>
                <div className="hours-day-num">{row?.month}-{String(row?.dayNum).padStart(2, "0")}</div>
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
            <div className="hours-summary-label">{t("profile.thisWeekStat")}</div>
            <div className="hours-summary-val">{totalWeek.toFixed(1)}<span className="hours-summary-unit">h</span></div>
          </div>
          <div className="hours-summary-stat">
            <div className="hours-summary-label">{t("profile.avgDay")}</div>
            <div className="hours-summary-val">{avgDay}<span className="hours-summary-unit">h</span></div>
          </div>
          <div className="hours-summary-stat">
            <div className="hours-summary-label">{t("profile.thisMonth")}</div>
            <div className="hours-summary-val">{totalMonth}<span className="hours-summary-unit">h</span></div>
          </div>
          <div className="hours-summary-stat">
            <div className="hours-summary-label">{t("profile.thisYear")}</div>
            <div className="hours-summary-val">{totalYear}<span className="hours-summary-unit">h</span></div>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{t("entry.title")}</h2>
            <span className="badge">{reports.length}</span>
          </div>
          {!reports.length ? (
            <div className="muted small ta-c" style={{ padding: 20 }}>{t("entry.none")}</div>
          ) : (
            <div className="reports-feed">
              {reports.map((row) => (
                <ReportEntry
                  key={row.id}
                  row={row}
                  hidePerson
                  onSelectProject={onSelectObject}
                  onOpen={onOpenReport}
                />
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{t("profile.assigned")}</h2>
            <span className="badge">{assigned.length}</span>
          </div>
          <div className="obj-list">
            {assigned.length === 0 && (
              <div className="muted small ta-c" style={{padding: 20}}>{t("profile.noneAssigned")}</div>
            )}
            {assigned.map((p) => (
              <div
                key={p.id}
                className="obj-row clickable"
                onClick={() => onSelectObject && onSelectObject(p.id)}
              >
                <div className="obj-row-head">
                  <span className="obj-id mono">#{p.id}</span>
                  <span className="obj-name">{p.name}</span>
                  <span className={`status ${statusClass(p.status)}`}>{t(STATUS_LABEL[p.status])}</span>
                </div>
                <div className="obj-row-meta">
                  <span>{p.client || p.address || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default WorkerProfile;
