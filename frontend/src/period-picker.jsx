import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./icons";
import { useI18n } from "./i18n";

const POP_WIDTH = 320;

const placePop = (anchor) => {
  if (!anchor) return { top: 0, left: 0 };
  const r = anchor.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.right - POP_WIDTH), window.innerWidth - POP_WIDTH - 8);
  return { top: r.bottom + 6, left };
};

const ymd = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y, m) => new Date(y, m, 0).getDate();

const localToday = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const fmtDate = (d) => ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());

const yearFromValue = (value) => {
  const y = Number(String(value?.from || "").slice(0, 4));
  return y || localToday().getFullYear();
};

const quarterBounds = (y, q) => {
  const startM = (q - 1) * 3 + 1;
  const endM = startM + 2;
  return { from: ymd(y, startM, 1), to: ymd(y, endM, lastDay(y, endM)) };
};

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
  const [year, setYear] = useState(() => yearFromValue(value));
  const [customFrom, setCustomFrom] = useState(value?.from || fmtDate(localToday()));
  const [customTo, setCustomTo] = useState(value?.to || fmtDate(localToday()));
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const popRef = useRef(null);
  const monthsShort = t("monthsShort");
  const months = t("months");

  useLayoutEffect(() => {
    if (!open) return;
    setPos(placePop(ref.current));
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    const onWin = () => setPos(placePop(ref.current));
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    setYear(yearFromValue(value));
    if (value?.from) setCustomFrom(value.from);
    if (value?.to) setCustomTo(value.to);
  }, [open, value?.from, value?.to]);

  const pickMonth = (y, m) => {
    onChange({ from: ymd(y, m, 1), to: ymd(y, m, lastDay(y, m)), label: `${months[m - 1]} ${y}` });
    setOpen(false);
  };
  const pickQuarter = (y, q) => {
    const range = quarterBounds(y, q);
    onChange({ ...range, label: `Q${q} ${y}` });
    setOpen(false);
  };
  const pickYear = (y) => {
    onChange({ from: ymd(y, 1, 1), to: ymd(y, 12, 31), label: t("period.year", { y }) });
    setOpen(false);
  };
  const pickPreset = (key) => {
    const today = localToday();
    const sub = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d;
    };
    let r;
    if (key === "today") r = { from: fmtDate(today), to: fmtDate(today), label: t("period.today") };
    if (key === "7") r = { from: fmtDate(sub(6)), to: fmtDate(today), label: t("period.last7") };
    if (key === "30") r = { from: fmtDate(sub(29)), to: fmtDate(today), label: t("period.last30") };
    if (key === "90") r = { from: fmtDate(sub(89)), to: fmtDate(today), label: t("period.last90") };
    if (key === "ytd") r = { from: ymd(today.getFullYear(), 1, 1), to: fmtDate(today), label: t("period.ytd", { y: today.getFullYear() }) };
    if (r) onChange(r);
    setOpen(false);
  };
  const applyCustom = () => {
    if (!customFrom || !customTo || customFrom > customTo) return;
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
      {open && createPortal(
        <div className="period-pop" ref={popRef} style={{ top: pos.top, left: pos.left }}>
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
              {[1, 2, 3, 4].map((q) => {
                const range = quarterBounds(year, q);
                const isActive = value?.from === range.from && value?.to === range.to;
                return (
                  <button key={q} className={`pp-quarter ${isActive ? "on" : ""}`} onClick={() => pickQuarter(year, q)}>
                    <div className="pp-q-name mono">Q{q}</div>
                    <div className="pp-q-months">{monthsShort[(q - 1) * 3]}–{monthsShort[(q - 1) * 3 + 2]}</div>
                  </button>
                );
              })}
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
              <button className="btn btn-primary pp-apply" onClick={applyCustom} disabled={!customFrom || !customTo || customFrom > customTo}>
                {t("period.apply")}
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default PeriodPicker;
export const PP_helpers = { ymd, lastDay, formatPeriod };
