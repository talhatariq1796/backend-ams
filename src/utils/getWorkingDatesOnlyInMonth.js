import { eachDayOfInterval, isWeekend } from "date-fns";

export function getWorkingDatesOnlyInMonth(month, year) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d));
}
