export function getDayTool(trip, { dayNumToIsoDate, isoDateToDayNum }) {
  return {
    description: 'Pełny obiekt dnia (atrakcje, godziny otwarcia, wskazówki) po numerze dnia (1-16) lub dacie ISO YYYY-MM-DD.',
    parameters: {
      type: 'object',
      properties: { day: { type: ['string', 'number'], description: 'Numer dnia (1-16) albo data ISO YYYY-MM-DD' } },
      required: ['day'],
    },
    execute({ day }) {
      const dayNum = typeof day === 'number' ? day : isoDateToDayNum(trip, day);
      const found = trip.days.find((d) => d.day_num === dayNum);
      if (!found) return null;
      return { ...found, iso_date: dayNumToIsoDate(trip, found.day_num) };
    },
  };
}
