export function searchFoodTool(trip) {
  return {
    description: 'Szuka restauracji/miejsc na jedzenie po nazwie miejsca, potrawie albo cenie. Przeszukuje day.food z trip.json, zwraca dopasowane dni z pełnym opisem jedzenia.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Fraza do wyszukania (np. nazwa restauracji, potrawa, "pizza")' } },
      required: ['query'],
    },
    execute({ query }) {
      const needle = query.toLowerCase();
      return trip.days
        .filter((day) => day.food)
        .filter((day) => {
          const haystack = [
            day.food.place ?? '',
            ...(day.food.dishes ?? []),
            day.food.price ?? '',
          ].join(' ').toLowerCase();
          return haystack.includes(needle);
        })
        .map((day) => ({ day_num: day.day_num, food: day.food }));
    },
  };
}
