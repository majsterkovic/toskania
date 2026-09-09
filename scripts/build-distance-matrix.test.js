import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectPoints, buildMatrixPayload } from './build-distance-matrix.js';

test('collectPoints: zbiera bazy i atrakcje z coords, pomija punkty bez coords', () => {
  const trip = {
    bases: [{ id: 'base1', name: 'Barga', coords: [44.06, 10.47] }],
    days: [
      {
        day_num: 1,
        attractions: [
          { name: 'Duomo', coords: [44.07, 10.48] },
          { name: 'Bez koordynatów', coords: null },
        ],
      },
    ],
  };
  const points = collectPoints(trip);
  assert.equal(points.length, 2);
  assert.deepEqual(points[0], { id: 'base1', name: 'Barga', lat: 44.06, lon: 10.47 });
  assert.deepEqual(points[1], { id: 'day1-attr0', name: 'Duomo', lat: 44.07, lon: 10.48 });
});

test('buildMatrixPayload: składa punkty + macierze z odpowiedzi OSRM /table', () => {
  const points = [
    { id: 'a', name: 'A', lat: 1, lon: 2 },
    { id: 'b', name: 'B', lat: 3, lon: 4 },
  ];
  const osrmResponse = {
    durations: [[0, 600], [600, 0]],
    distances: [[0, 5000], [5000, 0]],
  };
  const payload = buildMatrixPayload(points, osrmResponse);
  assert.deepEqual(payload.points, points);
  assert.deepEqual(payload.durations, osrmResponse.durations);
  assert.deepEqual(payload.distances, osrmResponse.distances);
});
