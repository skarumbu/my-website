import { initialNodes, initialEdges, repoUrlByPackage } from './arch-graph-data.ts';
import { PACKAGE_TEMPLATES } from './packageTemplates.ts';

test('daily_api node maps to the daily-api page key and has a package template', () => {
  const node = initialNodes.find(n => n.id === 'daily_api');
  expect(node).toBeDefined();
  expect(repoUrlByPackage['daily-api']).toBe('https://github.com/skarumbu/daily-api');
  expect(PACKAGE_TEMPLATES['daily-api']).toBeDefined();
});

test('every edge connects two existing nodes', () => {
  const ids = new Set(initialNodes.map(n => n.id));
  for (const edge of initialEdges) {
    expect(ids.has(edge.source)).toBe(true);
    expect(ids.has(edge.target)).toBe(true);
  }
});

test('no two nodes share a position', () => {
  const positions = initialNodes.map(n => `${n.position.x},${n.position.y}`);
  expect(new Set(positions).size).toBe(positions.length);
});
