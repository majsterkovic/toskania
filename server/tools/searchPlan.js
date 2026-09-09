function collectSearchable(trip) {
  const rows = [];
  for (const day of trip.days) {
    rows.push({ day_num: day.day_num, field: 'title', text: day.title ?? '' });
    rows.push({ day_num: day.day_num, field: 'summary', text: day.summary ?? '' });
    for (const a of day.attractions ?? []) {
      rows.push({ day_num: day.day_num, field: `attraction:${a.name}`, text: `${a.name} ${a.description ?? ''}` });
    }
  }
  return rows;
}

export function searchPlanTool(trip) {
  const rows = collectSearchable(trip);
  return {
    description: 'Szuka frazy tekstowo w tytułach dni, opisach i atrakcjach. Zwraca listę trafień z numerem dnia.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Fraza do wyszukania' } },
      required: ['query'],
    },
    execute({ query }) {
      const needle = query.toLowerCase();
      return rows
        .filter((r) => r.text.toLowerCase().includes(needle))
        .map((r) => ({ day_num: r.day_num, field: r.field }));
    },
  };
}
