/** Calendar arithmetic uses UTC dates to avoid daylight-saving shifts. */
export function addDays(date: string, count: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

export function weekStart(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  return addDays(date, -((value.getUTCDay() + 1) % 7));
}

export function currentWeekStart(now = new Date()) {
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return weekStart(localDate);
}