// PeriodPicker — flexible date-range picker with presets
// Returns { from: "YYYY-MM-DD", to: "YYYY-MM-DD", label: "..." }

const PP_MONTHS_LV = ["Janvāris","Februāris","Marts","Aprīlis","Maijs","Jūnijs","Jūlijs","Augusts","Septembris","Oktobris","Novembris","Decembris"];
const PP_MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mai","Jūn","Jūl","Aug","Sep","Okt","Nov","Dec"];

const ymd = (y, m, d) => `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const fmtRange = (from, to) => {
  if (!from || !to) return "Izvēlies periodu";
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (fy === ty && fm === tm && fd === 1 && td === lastDay(ty, tm)) return `${PP_MONTHS_LV[fm-1]} ${fy}`;
  if (fy === ty) return `${fd}. ${PP_MONTHS_SHORT[fm-1]} – ${td}. ${PP_MONTHS_SHORT[tm-1]} ${ty}`;
  return `${fd}.${PP_MONTHS_SHORT[fm-1]} ${fy} – ${td}.${PP_MONTHS_SHORT[tm-1]} ${ty}`;
};

const PeriodPicker = ({ value, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("month"); // month | quarter | preset | custom
  const [year, setYear] = React.useState(2026);
  const [customFrom, setCustomFrom] = React.useState(value?.from || "2026-05-01");
  const [customTo, setCustomTo] = React.useState(value?.to || "2026-05-31");
  const ref = React.useRef(null);

  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pickMonth = (y, m) => {
    const range = { from: ymd(y, m, 1), to: ymd(y, m, lastDay(y, m)), label: `${PP_MONTHS_LV[m-1]} ${y}` };
    onChange(range); setOpen(false);
  };
  const pickQuarter = (y, q) => {
    const startM = (q - 1) * 3 + 1, endM = startM + 2;
    const range = { from: ymd(y, startM, 1), to: ymd(y, endM, lastDay(y, endM)), label: `Q${q} ${y}` };
    onChange(range); setOpen(false);
  };
  const pickYear = (y) => {
    onChange({ from: ymd(y,1,1), to: ymd(y,12,31), label: `${y}. gads` }); setOpen(false);
  };
  const pickPreset = (key) => {
    const today = new Date(2026, 4, 6); // mock today: 2026-05-06
    const t = (d) => ymd(d.getFullYear(), d.getMonth()+1, d.getDate());
    const sub = (n) => { const d = new Date(today); d.setDate(d.getDate()-n); return d; };
    let r;
    if (key === "today") r = { from: t(today), to: t(today), label: "Šodien" };
    if (key === "7") r = { from: t(sub(6)), to: t(today), label: "Pēdējās 7 dienas" };
    if (key === "30") r = { from: t(sub(29)), to: t(today), label: "Pēdējās 30 dienas" };
    if (key === "90") r = { from: t(sub(89)), to: t(today), label: "Pēdējās 90 dienas" };
    if (key === "ytd") r = { from: ymd(today.getFullYear(),1,1), to: t(today), label: `${today.getFullYear()}. gads (līdz šodien)` };
    onChange(r); setOpen(false);
  };
  const applyCustom = () => {
    if (customFrom > customTo) return;
    onChange({ from: customFrom, to: customTo, label: fmtRange(customFrom, customTo) });
    setOpen(false);
  };

  const label = value?.label || fmtRange(value?.from, value?.to);

  return (
    <div className="period-picker" ref={ref}>
      <button className="period-trigger" onClick={() => setOpen(o => !o)}>
        <Icon name="calendar" size={14} />
        <span className="period-label">{label}</span>
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className="period-pop">
          <div className="period-tabs">
            <button className={`pp-tab ${tab==="month"?"on":""}`} onClick={() => setTab("month")}>Mēnesis</button>
            <button className={`pp-tab ${tab==="quarter"?"on":""}`} onClick={() => setTab("quarter")}>Ceturksnis</button>
            <button className={`pp-tab ${tab==="preset"?"on":""}`} onClick={() => setTab("preset")}>Ātri</button>
            <button className={`pp-tab ${tab==="custom"?"on":""}`} onClick={() => setTab("custom")}>Pielāgots</button>
          </div>

          {(tab === "month" || tab === "quarter") && (
            <div className="pp-year-nav">
              <button className="icon-btn sm" onClick={() => setYear(y => y - 1)}><Icon name="chevronLeft" size={13} /></button>
              <span className="pp-year mono">{year}</span>
              <button className="icon-btn sm" onClick={() => setYear(y => y + 1)}><Icon name="chevronRight" size={13} /></button>
              <button className="pp-year-quick" onClick={() => pickYear(year)}>Viss gads</button>
            </div>
          )}

          {tab === "month" && (
            <div className="pp-month-grid">
              {PP_MONTHS_SHORT.map((m, i) => {
                const isActive = value && value.from === ymd(year, i+1, 1) && value.to === ymd(year, i+1, lastDay(year, i+1));
                return (
                  <button key={i} className={`pp-cell ${isActive?"on":""}`} onClick={() => pickMonth(year, i+1)}>{m}</button>
                );
              })}
            </div>
          )}

          {tab === "quarter" && (
            <div className="pp-quarter-grid">
              {[1,2,3,4].map(q => (
                <button key={q} className="pp-quarter" onClick={() => pickQuarter(year, q)}>
                  <div className="pp-q-name mono">Q{q}</div>
                  <div className="pp-q-months">{PP_MONTHS_SHORT[(q-1)*3]}–{PP_MONTHS_SHORT[(q-1)*3+2]}</div>
                </button>
              ))}
            </div>
          )}

          {tab === "preset" && (
            <div className="pp-preset-list">
              <button className="pp-preset" onClick={() => pickPreset("today")}>Šodien</button>
              <button className="pp-preset" onClick={() => pickPreset("7")}>Pēdējās 7 dienas</button>
              <button className="pp-preset" onClick={() => pickPreset("30")}>Pēdējās 30 dienas</button>
              <button className="pp-preset" onClick={() => pickPreset("90")}>Pēdējās 90 dienas</button>
              <button className="pp-preset" onClick={() => pickPreset("ytd")}>Šis gads (YTD)</button>
            </div>
          )}

          {tab === "custom" && (
            <div className="pp-custom">
              <label className="pp-field">
                <span>No</span>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </label>
              <label className="pp-field">
                <span>Līdz</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </label>
              <button className="btn btn-primary pp-apply" onClick={applyCustom}>Piemērot</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

window.PeriodPicker = PeriodPicker;
window.PP_helpers = { ymd, lastDay, fmtRange };
