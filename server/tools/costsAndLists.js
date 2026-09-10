export function costsTool(trip) {
  return {
    description: 'Zestawienie kosztów wycieczki z trip.json.',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: () => trip.costs,
  };
}

export function todoTool(trip) {
  return {
    description: 'Lista rzeczy do zrobienia przed/w trakcie wycieczki z trip.json.',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: () => trip.todo,
  };
}

export function packingTool(trip) {
  return {
    description: 'Wspólna lista pakowania grupy (nie ubrania osobiste) z trip.json: apteczka, rzeczy do bazy, kable, auto.',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: () => trip.packing_list,
  };
}
