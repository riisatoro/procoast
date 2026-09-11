export const WEEKDAY_KEYS = ["P", "O", "T", "C", "Pk", "S", "Sv"];

export const DEFAULT_CAL_SETTINGS = {
  holidays: [],
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

export function settingsFromApi(data) {
  return {
    ...DEFAULT_CAL_SETTINGS,
    holidays: Array.isArray(data?.holidays)
      ? data.holidays.map((h) => ({ date: h.date, name: h.name }))
      : [],
    weekend: Array.isArray(data?.weekend) ? [...data.weekend] : [...DEFAULT_CAL_SETTINGS.weekend],
    workStart: data?.work_start || DEFAULT_CAL_SETTINGS.workStart,
    workEnd: data?.work_end || DEFAULT_CAL_SETTINGS.workEnd,
    breakMin: data?.break_min ?? DEFAULT_CAL_SETTINGS.breakMin,
    autoShift: data?.auto_shift ?? DEFAULT_CAL_SETTINGS.autoShift,
    warnHoliday: data?.warn_holiday ?? DEFAULT_CAL_SETTINGS.warnHoliday,
    allowOverlap: data?.allow_overlap ?? DEFAULT_CAL_SETTINGS.allowOverlap,
    confirmDelete: data?.confirm_delete ?? DEFAULT_CAL_SETTINGS.confirmDelete,
    firstDay: data?.first_day || DEFAULT_CAL_SETTINGS.firstDay,
    colorBy: data?.color_by || DEFAULT_CAL_SETTINGS.colorBy,
    showInitials: data?.show_initials !== false,
  };
}

export function settingsToApi(settings) {
  return {
    holidays: (settings.holidays || []).map((h) => ({ date: h.date, name: h.name })),
    weekend: settings.weekend,
    work_start: settings.workStart,
    work_end: settings.workEnd,
    break_min: settings.breakMin,
    auto_shift: settings.autoShift,
    warn_holiday: settings.warnHoliday,
    allow_overlap: settings.allowOverlap,
    confirm_delete: settings.confirmDelete,
    first_day: settings.firstDay,
    color_by: settings.colorBy,
    show_initials: settings.showInitials,
  };
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
