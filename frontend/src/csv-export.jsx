import { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { downloadExportCsv } from "./api";
import { useI18n } from "./i18n";

const KINDS = [
  { id: "activity", labelKey: "csv.activity" },
  { id: "hours", labelKey: "csv.hours" },
  { id: "m2", labelKey: "csv.m2" },
];

const CsvExportMenu = ({ from, to, userId }) => {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const run = async (type) => {
    if (busy) return;
    setBusy(type);
    setErr("");
    try {
      await downloadExportCsv({
        type,
        from,
        to,
        user: userId,
        lang: locale,
      });
      setOpen(false);
    } catch (error) {
      setErr(error.message || t("api.exportCsv"));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className={`csv-export ${open ? "open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="btn btn-outline"
        disabled={Boolean(busy)}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="download" size={15} />
        {busy ? t("csv.exporting") : t("csv.export")}
        <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <div className="csv-menu">
          <div className="csv-menu-hint">{t("csv.hint")}</div>
          {KINDS.map((kind) => (
            <button
              key={kind.id}
              type="button"
              className="csv-menu-item"
              disabled={Boolean(busy)}
              onClick={() => run(kind.id)}
            >
              <Icon name={kind.id === "hours" ? "clock" : kind.id === "m2" ? "chart" : "clipboard"} size={14} />
              <span>{t(kind.labelKey)}</span>
            </button>
          ))}
          {err && <div className="login-err csv-menu-err">{err}</div>}
        </div>
      )}
    </div>
  );
};

export default CsvExportMenu;
