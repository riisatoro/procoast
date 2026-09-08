import { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { useI18n } from "./i18n";

const ymd = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y, m) => new Date(y, m, 0).getDate();

export const formatPeriod = (from, to, tr) => {
  if (!from || !to) return tr("period.pick");
  const months = tr("months");
  const short = tr("monthsShort");
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (fy === ty && fm === tm && fd === 1 && td === lastDay(ty, tm)) return `${months[fm - 1]} ${fy}`;
  if (fy === ty) return `${fd}. ${short[fm - 1]} – ${td}. ${short[tm - 1]} ${ty}`;
  return `${fd}.${short[fm - 1]} ${fy} – ${td}.${short[tm - 1]} ${ty}`;
};

const PeriodPicker = ({ value, onChange }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("month");
  const [year, setYear] = useState(2026);
  const [customFrom, setCustomFrom] = useState(value?.from || "2026-05-01");
  const [customTo, setCustomTo] = useState(value?.to || "2026-05-31");
  const ref = useRef(null);
  const monthsShort = t("monthsShort");
  const months = t("months");

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pickMonth = (y, m) => {
    onChange({ from: ymd(y, m, 1), to: ymd(y, m, lastDay(y, m)), label: `${months[m - 1]} ${y}` });
    setOpen(false);
  };
  const pickQuarter = (y, q) => {
    const startM = (q - 1) * 3 + 1, endM = startM + 2;
    onChange({ from: ymd(y, startM, 1), to: ymd(y, endM, lastDay(y, endM)), label: `Q${q} ${y}` });
    setOpen(false);
  };
  const pickYear = (y) => {
    onChange({ from: ymd(y, 1, 1), to: ymd(y, 12, 31), label: t("period.year", { y }) });
    setOpen(false);
  };
  const pickPreset = (key) => {
    const today = new Date(2026, 4, 6);
    const fmt = (d) => ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const sub = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
    let r;
    if (key === "today") r = { from: fmt(today), to: fmt(today), label: t("period.today") };
    if (key === "7") r = { from: fmt(sub(6)), to: fmt(today), label: t("period.last7") };
    if (key === "30") r = { from: fmt(sub(29)), to: fmt(today), label: t("period.last30") };
    if (key === "90") r = { from: fmt(sub(89)), to: fmt(today), label: t("period.last90") };
    if (key === "ytd") r = { from: ymd(today.getFullYear(), 1, 1), to: fmt(today), label: t("period.ytd", { y: today.getFullYear() }) };
    onChange(r); setOpen(false);
  };
  const applyCustom = () => {
    if (customFrom > customTo) return;
    onChange({ from: customFrom, to: customTo, label: formatPeriod(customFrom, customTo, t) });
    setOpen(false);
  };

  const label = value?.from && value?.to ? formatPeriod(value.from, value.to, t) : (value?.label || t("period.pick"));

  return (
    <div className="period-picker" ref={ref}>
      <button className="period-trigger" onClick={() => setOpen((o) => !o)}>
        <Icon name="calendar" size={14} />
        <span className="period-label">{label}</span>
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className="period-pop">
          <div className="period-tabs">
            <button className={`pp-tab ${tab === "month" ? "on" : ""}`} onClick={() => setTab("month")}>{t("period.month")}</button>
            <button className={`pp-tab ${tab === "quarter" ? "on" : ""}`} onClick={() => setTab("quarter")}>{t("period.quarter")}</button>
            <button className={`pp-tab ${tab === "preset" ? "on" : ""}`} onClick={() => setTab("preset")}>{t("period.preset")}</button>
            <button className={`pp-tab ${tab === "custom" ? "on" : ""}`} onClick={() => setTab("custom")}>{t("period.custom")}</button>
          </div>

          {(tab === "month" || tab === "quarter") && (
            <div className="pp-year-nav">
              <button className="icon-btn sm" onClick={() => setYear((y) => y - 1)}><Icon name="chevronLeft" size={13} /></button>
              <span className="pp-year mono">{year}</span>
              <button className="icon-btn sm" onClick={() => setYear((y) => y + 1)}><Icon name="chevronRight" size={13} /></button>
              <button className="pp-year-quick" onClick={() => pickYear(year)}>{t("period.wholeYear")}</button>
            </div>
          )}

          {tab === "month" && (
            <div className="pp-month-grid">
              {monthsShort.map((m, i) => {
                const isActive = value && value.from === ymd(year, i + 1, 1) && value.to === ymd(year, i + 1, lastDay(year, i + 1));
                return (
                  <button key={i} className={`pp-cell ${isActive ? "on" : ""}`} onClick={() => pickMonth(year, i + 1)}>{m}</button>
                );
              })}
            </div>
          )}

          {tab === "quarter" && (
            <div className="pp-quarter-grid">
              {[1, 2, 3, 4].map((q) => (
                <button key={q} className="pp-quarter" onClick={() => pickQuarter(year, q)}>
                  <div className="pp-q-name mono">Q{q}</div>
                  <div className="pp-q-months">{monthsShort[(q - 1) * 3]}–{monthsShort[(q - 1) * 3 + 2]}</div>
                </button>
              ))}
            </div>
          )}

          {tab === "preset" && (
            <div className="pp-preset-list">
              <button className="pp-preset" onClick={() => pickPreset("today")}>{t("period.today")}</button>
              <button className="pp-preset" onClick={() => pickPreset("7")}>{t("period.last7")}</button>
              <button className="pp-preset" onClick={() => pickPreset("30")}>{t("period.last30")}</button>
              <button className="pp-preset" onClick={() => pickPreset("90")}>{t("period.last90")}</button>
              <button className="pp-preset" onClick={() => pickPreset("ytd")}>{t("period.ytdShort")}</button>
            </div>
          )}

          {tab === "custom" && (
            <div className="pp-custom">
              <label className="pp-field">
                <span>{t("period.from")}</span>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </label>
              <label className="pp-field">
                <span>{t("period.to")}</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </label>
              <button className="btn btn-primary pp-apply" onClick={applyCustom}>{t("period.apply")}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PeriodPicker;
export const PP_helpers = { ymd, lastDay, formatPeriod };
