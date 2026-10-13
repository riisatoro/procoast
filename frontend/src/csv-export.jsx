import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./icons";
import { downloadExportCsv } from "./api";
import { useI18n } from "./i18n";

const MENU_WIDTH = 260;

const placeMenu = (anchor) => {
  if (!anchor) return { top: 0, left: 0 };
  const r = anchor.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
  return { top: r.bottom + 6, left };
};

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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return;
    setPos(placeMenu(wrapRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onWin = () => setPos(placeMenu(wrapRef.current));
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
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
      {open &&
        createPortal(
          <div className="csv-menu" ref={menuRef} style={{ top: pos.top, left: pos.left }}>
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
          </div>,
          document.body
        )}
    </div>
  );
};

export default CsvExportMenu;
