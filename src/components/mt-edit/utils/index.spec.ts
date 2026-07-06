import { describe, expect, it } from 'vitest';
import { getCanvasBinfoFromClientRect, getCanvasPointFromOffset } from './index';

describe('canvas coordinate transform helpers', () => {
  it('converts viewport offsets to canvas coordinates with transform origin', () => {
    const point = getCanvasPointFromOffset(960, 540, 0.8, { x: 1200, y: 675 });

    expect(point).toEqual({ x: 900, y: 506.25 });
  });

  it('converts client rects to canvas bounds with transform origin', () => {
    const canvasRect = { left: 200, top: 100 } as DOMRect;
    const itemRect = { left: 1040, top: 540, width: 80, height: 40 } as DOMRect;

    const binfo = getCanvasBinfoFromClientRect(itemRect, canvasRect, 0.8, {
      x: 1000,
      y: 600
    });

    expect(binfo).toEqual({
      left: 800,
      top: 400,
      width: 100,
      height: 50
    });
  });
});
