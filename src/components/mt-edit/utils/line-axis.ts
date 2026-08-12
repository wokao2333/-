import type { DrawLineMode, LineAxisLock } from '../store/types';

export interface LinePoint {
  x: number;
  y: number;
}

export const drawLineModeToAxisLock = (mode: DrawLineMode): LineAxisLock | undefined => {
  return mode === 'free' ? undefined : mode;
};

export const systemLineIdToAxisLock = (id: string): LineAxisLock | undefined => {
  if (id === 'sys-line') return 'horizontal';
  if (id === 'sys-line-vertical') return 'vertical';
  return undefined;
};

export const constrainPointToLineAxis = (
  origin: LinePoint,
  candidate: LinePoint,
  axisLock?: LineAxisLock
): LinePoint => {
  if (axisLock === 'vertical') {
    return { x: origin.x, y: candidate.y };
  }
  if (axisLock === 'horizontal') {
    return { x: candidate.x, y: origin.y };
  }
  return { ...candidate };
};

export const moveLinePoint = (
  points: LinePoint[],
  pointIndex: number,
  candidate: LinePoint,
  axisLock?: LineAxisLock
): LinePoint[] => {
  const origin = points[pointIndex];
  if (!origin) return points;

  const nextPoint = constrainPointToLineAxis(origin, candidate, axisLock);
  return points.map((point, index) => (index === pointIndex ? nextPoint : point));
};
