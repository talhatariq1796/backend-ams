export const getDateRangeFromFilter = (
  filter_type,
  start_date = null,
  end_date = null
) => {
  const now = new Date();
  let startDate, endDate;
  switch (filter_type) {
    case "this_week":
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(
        weekStart.getDate() -
          (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1)
      );

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      startDate = weekStart;
      endDate = weekEnd;
      break;

    case "this_month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
      break;

    case "last_month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;

    case "custom_range":
      if (start_date && end_date) {
        startDate = new Date(start_date);
        endDate = new Date(end_date);
      } else {
        throw new Error("Custom range requires start_date and end_date");
      }
      break;

    default:
      throw new Error("Invalid filter type");
  }

  return { startDate, endDate };
};
