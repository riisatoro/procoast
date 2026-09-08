import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { messages } from "./locales";

export const DEFAULT_LOCALE = "lv";
const STORAGE_KEY = "procoast-locale";

const listeners = new Set();

function lookup(dict, key) {
  return key.split(".").reduce((acc, part) => (acc != null ? acc[part] : undefined), dict);
}

function interpolate(value, vars) {
  if (typeof value !== "string" || !vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) => (vars[name] != null ? String(vars[name]) : `{${name}}`));
}

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "lv") return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

let currentLocale = DEFAULT_LOCALE;

export function getLocale() {
  return currentLocale;
}

export function applyLocale(next) {
  const locale = next === "en" ? "en" : DEFAULT_LOCALE;
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    const title = lookup(messages[locale], "meta.title");
    if (title) document.title = title;
  }
  listeners.forEach((fn) => fn(locale));
}

export function t(key, vars) {
  const value = lookup(messages[currentLocale], key) ?? lookup(messages[DEFAULT_LOCALE], key) ?? key;
  return interpolate(value, vars);
}

export function dateLocale() {
  return currentLocale === "en" ? "en-GB" : "lv-LV";
}

export function initLocale() {
  applyLocale(readStored());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  t,
  setLocale: applyLocale,
  dateLocale: "lv-LV",
});

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    initLocale();
    return currentLocale;
  });

  useEffect(() => subscribe(setLocaleState), []);

  const value = useMemo(
    () => ({
      locale,
      t,
      setLocale: applyLocale,
      dateLocale: locale === "en" ? "en-GB" : "lv-LV",
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageSwitch({ variant = "dark" }) {
  const { locale, setLocale, t: tr } = useI18n();
  return (
    <div className={`lang-switch ${variant}`} role="group" aria-label={tr("lang.label")}>
      <button type="button" className={locale === "lv" ? "on" : ""} onClick={() => setLocale("lv")}>
        LV
      </button>
      <button type="button" className={locale === "en" ? "on" : ""} onClick={() => setLocale("en")}>
        EN
      </button>
    </div>
  );
}
