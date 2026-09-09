export function listDaysTool(trip, { dayNumToIsoDate }) {
  return {
    description: 'Lista wszystkich dni wycieczki ze skrótowymi informacjami (spis treści planu).',
    parameters: { type: 'object', properties: {}, required: [] },
    execute() {
      return trip.days.map((d) => ({
        day_num: d.day_num,
        date: dayNumToIsoDate(trip, d.day_num),
        title: d.title,
        label: d.label,
        base_id: d.base_id,
        summary: d.summary,
      }));
    },
  };
}
