export function routeTool(distanceMatrix) {
  const indexById = new Map(distanceMatrix.points.map((p, i) => [p.id, i]));
  return {
    description: 'Odległość i czas jazdy między dwoma punktami planu (po id z distance-matrix.json).',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'id punktu startowego' },
        to: { type: 'string', description: 'id punktu docelowego' },
      },
      required: ['from', 'to'],
    },
    execute({ from, to }) {
      const i = indexById.get(from);
      const j = indexById.get(to);
      if (i === undefined || j === undefined) return null;
      const min = distanceMatrix.durations[i][j] / 60;
      const km = distanceMatrix.distances[i][j] / 1000;
      return { km, min, source: 'matrix' };
    },
  };
}
