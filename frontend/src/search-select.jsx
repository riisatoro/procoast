import { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { useI18n } from "./i18n";

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
}) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const selected = options.find((o) => String(o.id) === String(value));

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = options.filter(
    (o) => !q || `${o.label} ${o.sub || ""}`.toLowerCase().includes(q)
  );

  return (
    <div className={`ss ${open ? "open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="ss-trigger"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="search" size={14} />
        <span className={`ss-value ${selected ? "" : "placeholder"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="ss-menu">
          <input
            ref={inputRef}
            className="ss-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
          />
          <div className="ss-list">
            {filtered.length === 0 && (
              <div className="ss-empty">{t("calendar.emptySearch")}</div>
            )}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`ss-option ${String(o.id) === String(value) ? "on" : ""}`}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="ss-option-label">{o.label}</span>
                {o.sub && <span className="ss-option-sub">{o.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
