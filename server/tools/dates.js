const DAY_MS = 24 * 60 * 60 * 1000;

export function dayNumToIsoDate(trip, dayNum) {
  const start = Date.parse(`${trip.meta.start_date}T00:00:00Z`);
  const d = new Date(start + (dayNum - 1) * DAY_MS);
  return d.toISOString().slice(0, 10);
}

export function isoDateToDayNum(trip, isoDate) {
  const start = Date.parse(`${trip.meta.start_date}T00:00:00Z`);
  const target = Date.parse(`${isoDate}T00:00:00Z`);
  return Math.round((target - start) / DAY_MS) + 1;
}
