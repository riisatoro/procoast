const KEY = "procoast-cal-settings";

export const WEEKDAY_KEYS = ["P", "O", "T", "C", "Pk", "S", "Sv"];

export const DEFAULT_HOLIDAYS = [
  { date: "2026-05-01", name: "Darba svētki" },
  { date: "2026-05-04", name: "Latvijas Republikas Neatkarības atjaunošanas diena" },
  { date: "2026-06-23", name: "Līgo diena" },
  { date: "2026-06-24", name: "Jāņu diena" },
  { date: "2026-11-18", name: "Latvijas Republikas proklamēšanas diena" },
];

export const DEFAULT_CAL_SETTINGS = {
  holidays: DEFAULT_HOLIDAYS,
  weekend: ["S", "Sv"],
  workStart: "08:00",
  workEnd: "17:00",
  breakMin: 60,
  autoShift: true,
  warnHoliday: true,
  allowOverlap: false,
  confirmDelete: true,
  firstDay: "monday",
  colorBy: "object",
  showInitials: true,
};

function clone(settings) {
  return {
    ...DEFAULT_CAL_SETTINGS,
    ...settings,
    holidays: Array.isArray(settings?.holidays)
      ? settings.holidays.map((h) => ({ date: h.date, name: h.name }))
      : DEFAULT_HOLIDAYS.map((h) => ({ ...h })),
    weekend: Array.isArray(settings?.weekend) ? [...settings.weekend] : [...DEFAULT_CAL_SETTINGS.weekend],
  };
}

export function loadCalSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULT_CAL_SETTINGS);
    return clone({ ...DEFAULT_CAL_SETTINGS, ...JSON.parse(raw) });
  } catch {
    return clone(DEFAULT_CAL_SETTINGS);
  }
}

export function saveCalSettings(settings) {
  const next = clone(settings);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function ymd(d) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function weekdayKey(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return WEEKDAY_KEYS[(d.getDay() + 6) % 7];
}

export function isOffDay(dateStr, settings) {
  if (settings.weekend.includes(weekdayKey(dateStr))) return true;
  return (settings.holidays || []).some((h) => h.date === dateStr);
}

export function holidayName(dateStr, settings) {
  return (settings.holidays || []).find((h) => h.date === dateStr)?.name || "";
}

export function nextWorkday(dateStr, settings) {
  let cur = dateStr;
  for (let i = 0; i < 21; i++) {
    if (!isOffDay(cur, settings)) return cur;
    cur = addDays(cur, 1);
  }
  return dateStr;
}

export function workHoursLength(settings) {
  const start = (settings.workStart || "08:00").split(":").map(Number);
  const end = (settings.workEnd || "17:00").split(":").map(Number);
  const minutes = end[0] * 60 + (end[1] || 0) - (start[0] * 60 + (start[1] || 0)) - Number(settings.breakMin || 0);
  return Math.max(0, Math.round(minutes / 6) / 10);
}
