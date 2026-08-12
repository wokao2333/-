import { describe, expect, it } from 'vitest';
import { drawLineModeToAxisLock, moveLinePoint, systemLineIdToAxisLock } from './line-axis';

describe('line axis behavior', () => {
  it('persists toolbar and system component directions with the same axis lock', () => {
    expect(drawLineModeToAxisLock('free')).toBeUndefined();
    expect(drawLineModeToAxisLock('horizontal')).toBe('horizontal');
    expect(drawLineModeToAxisLock('vertical')).toBe('vertical');
    expect(systemLineIdToAxisLock('sys-line')).toBe('horizontal');
    expect(systemLineIdToAxisLock('sys-line-vertical')).toBe('vertical');
  });

  it.each([
    ['free', undefined, { x: 30, y: 45 }],
    ['horizontal', 'horizontal' as const, { x: 30, y: 20 }],
    ['vertical', 'vertical' as const, { x: 10, y: 45 }]
  ])('moves the existing endpoint in %s mode without adding a point', (_, axisLock, expected) => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 20 }
    ];

    const moved = moveLinePoint(points, 1, { x: 30, y: 45 }, axisLock);

    expect(moved).toHaveLength(2);
    expect(moved[1]).toEqual(expected);
    expect(points[1]).toEqual({ x: 10, y: 20 });
  });
});
