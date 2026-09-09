function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function openingHoursTool(trip, { isoDateToDayNum }) {
  return {
    description: 'Godziny otwarcia miejsca w danym dniu. Zwraca null, jeśli nie ma danych — nie zgaduje.',
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string', description: 'Nazwa lub slug miejsca' },
        date: { type: 'string', description: 'Data ISO YYYY-MM-DD' },
      },
      required: ['place', 'date'],
    },
    execute({ place, date }) {
      const dayNum = isoDateToDayNum(trip, date);
      const day = trip.days.find((d) => d.day_num === dayNum);
      if (!day) return null;
      const slug = slugify(place);
      if (day.opening_hours?.[slug]) return day.opening_hours[slug];
      const bySlugKey = Object.keys(day.opening_hours ?? {}).find((k) => k.includes(slug) || slug.includes(k));
      if (bySlugKey) return day.opening_hours[bySlugKey];
      const attraction = (day.attractions ?? []).find((a) => slugify(a.name).includes(slug) || slug.includes(slugify(a.name)));
      return attraction?.opening_hours ?? null;
    },
  };
}
