import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildToolRegistry } from './index.js';

const trip = {
  meta: { start_date: '2026-09-12' },
  bases: [{ id: 'base1', name: 'Barga', coords: [44.06, 10.47] }],
  days: [
    {
      day_num: 1, date: '12.09 (sob)', type: 'transit', base_id: null,
      title: 'Dojazd', label: 'DZIEŃ 1', summary: 'Jazda do Toskanii.',
      attractions: [],
      opening_hours: {},
    },
    {
      day_num: 8, date: '19.09 (sob)', type: 'tuscany', base_id: 'base2',
      title: 'Chianti', label: 'DZIEŃ 8', summary: 'Winnice i zamki.',
      attractions: [
        { name: 'Castello di Brolio', coords: [43.47, 11.48], opening_hours: '10:00–18:00', description: 'Zamek i winnica.' },
      ],
      opening_hours: { castello_di_brolio: '10:00–18:00, zamknięte poniedziałki' },
    },
  ],
  costs: { total_eur: 5000 },
  todo: { przed_wyjazdem: ['Sprawdzić opony'] },
  packing_list: { dokumenty: ['Paszport'] },
};

const distanceMatrix = {
  points: [
    { id: 'base1', name: 'Barga', lat: 44.06, lon: 10.47 },
    { id: 'day8-attr0', name: 'Castello di Brolio', lat: 43.47, lon: 11.48 },
  ],
  durations: [[0, 3600], [3600, 0]],
  distances: [[0, 40000], [40000, 0]],
};

const tools = buildToolRegistry({ trip, distanceMatrix });

test('listDays: zwraca skrócone dni z day_num, date, title, label, base_id, summary', () => {
  const days = tools.listDays.execute({});
  assert.equal(days.length, 2);
  assert.deepEqual(days[0], {
    day_num: 1, date: '2026-09-12', title: 'Dojazd', label: 'DZIEŃ 1', base_id: null, summary: 'Jazda do Toskanii.',
  });
});

test('getDay: po numerze zwraca pełny obiekt dnia z dołożoną datą ISO', () => {
  const day = tools.getDay.execute({ day: 8 });
  assert.equal(day.day_num, 8);
  assert.equal(day.iso_date, '2026-09-19');
  assert.equal(day.title, 'Chianti');
});

test('getDay: po dacie ISO zwraca ten sam dzień co po numerze', () => {
  const byDate = tools.getDay.execute({ day: '2026-09-19' });
  const byNum = tools.getDay.execute({ day: 8 });
  assert.deepEqual(byDate, byNum);
});

test('getDay: nieistniejący dzień zwraca null, nie rzuca', () => {
  assert.equal(tools.getDay.execute({ day: 99 }), null);
});

test('searchPlan: trafia frazę w tytule dnia i nazwie atrakcji, zwraca day_num', () => {
  const hits = tools.searchPlan.execute({ query: 'Brolio' });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].day_num, 8);
});

test('searchPlan: brak trafień zwraca pustą listę', () => {
  assert.deepEqual(tools.searchPlan.execute({ query: 'coś czego nie ma' }), []);
});

test('route: zgadza się z macierzą po id punktów', () => {
  const r = tools.route.execute({ from: 'base1', to: 'day8-attr0' });
  assert.deepEqual(r, { km: 40, min: 60, source: 'matrix' });
});

test('route: brak punktu w macierzy zwraca null', () => {
  assert.equal(tools.route.execute({ from: 'base1', to: 'nieznany' }), null);
});

test('openingHours: trafienie po slugu z opening_hours dnia', () => {
  const h = tools.openingHours.execute({ place: 'castello_di_brolio', date: '2026-09-19' });
  assert.equal(h, '10:00–18:00, zamknięte poniedziałki');
});

test('openingHours: fallback do opening_hours atrakcji po dopasowaniu nazwy', () => {
  const tripNoDayHours = structuredClone(trip);
  tripNoDayHours.days.find((d) => d.day_num === 8).opening_hours = {};
  const tools2 = buildToolRegistry({ trip: tripNoDayHours, distanceMatrix });
  const h = tools2.openingHours.execute({ place: 'Brolio', date: '2026-09-19' });
  assert.equal(h, '10:00–18:00');
});

test('openingHours: brak danych zwraca null, nie zgaduje', () => {
  assert.equal(tools.openingHours.execute({ place: 'nieznane miejsce', date: '2026-09-19' }), null);
});

test('costs: zwraca costs z trip.json bez zmian', () => {
  assert.deepEqual(tools.costs.execute({}), trip.costs);
});

test('todo: zwraca todo z trip.json bez zmian', () => {
  assert.deepEqual(tools.todo.execute({}), trip.todo);
});

test('packing: zwraca packing_list z trip.json bez zmian', () => {
  assert.deepEqual(tools.packing.execute({}), trip.packing_list);
});
