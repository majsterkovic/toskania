import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayRouteCoords, kmFieldFor, fetchRouteKm } from './refresh-km.js';

const basesById = {
  base1: { id: 'base1', coords: [44.0, 10.5] },
  base2: { id: 'base2', coords: [43.1, 11.3] },
};

test('dayRouteCoords: transit bierze route_points', () => {
  const day = {
    type: 'transit',
    route_points: [{ coords: [52.4, 16.9] }, { label: 'bez coords' }, { coords: [48.0, 11.6] }],
  };
  assert.deepEqual(dayRouteCoords(day, basesById), [[52.4, 16.9], [48.0, 11.6]]);
});

test('dayRouteCoords: zwykły dzień to pętla baza → atrakcje → baza', () => {
  const day = { type: 'tuscany', base_id: 'base1', attractions: [{ coords: [44.07, 10.48] }] };
  assert.deepEqual(dayRouteCoords(day, basesById), [[44.0, 10.5], [44.07, 10.48], [44.0, 10.5]]);
});

test('dayRouteCoords: transfer kończy w nowej bazie bez domknięcia', () => {
  const day = {
    type: 'tuscany_transfer', base_id: 'base1', next_base_id: 'base2',
    attractions: [{ coords: [43.9, 10.9] }],
  };
  assert.deepEqual(dayRouteCoords(day, basesById), [[44.0, 10.5], [43.9, 10.9], [43.1, 11.3]]);
});

test('kmFieldFor: szanuje istniejące pole, transit defaultuje drive_km', () => {
  assert.equal(kmFieldFor({ type: 'transit', drive_km: 900 }), 'drive_km');
  assert.equal(kmFieldFor({ type: 'tuscany', daily_km_estimate: 40 }), 'daily_km_estimate');
  assert.equal(kmFieldFor({ type: 'transit' }), 'drive_km');
  assert.equal(kmFieldFor({ type: 'tuscany' }), 'daily_km_estimate');
});

test('fetchRouteKm: metry → km, błędy → null', async () => {  const ok = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ routes: [{ distance: 41500 }] }) });
  assert.equal(await fetchRouteKm([[44, 10.5], [44.07, 10.48]], ok), 42);
  const bad = () => Promise.resolve({ ok: false });
  assert.equal(await fetchRouteKm([[44, 10.5], [44.07, 10.48]], bad), null);
  assert.equal(await fetchRouteKm([[44, 10.5]], ok), null);
});
