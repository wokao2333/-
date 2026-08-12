import { describe, expect, it } from 'vitest';
import type { IDoneJson } from '@/components/mt-edit/store/types';
import {
  clampResizeDimension,
  DEFAULT_RESIZE_MIN_SCALE,
  getResizeMinSize,
  normalizeResizeBaseSizes
} from './resize-constraints';
import { getNewStyle } from './utils';

const createItem = (overrides: Partial<IDoneJson> = {}): IDoneJson => ({
  id: 'item',
  title: '图元',
  type: 'svg',
  binfo: { left: 0, top: 0, width: 120, height: 80, angle: 0 },
  props: {},
  resize: true,
  rotate: true,
  lock: false,
  active: false,
  hide: false,
  common_animations: { val: '', delay: '', speed: '', repeat: '' },
  events: [],
  ...overrides
});

describe('图元最小缩放约束', () => {
  it('默认最多缩小到初始尺寸的 50%', () => {
    const item = createItem({ resize_base_size: { width: 120, height: 80 } });

    expect(DEFAULT_RESIZE_MIN_SCALE).toBe(0.5);
    expect(getResizeMinSize(item)).toEqual({ width: 60, height: 40 });
  });

  it('连续缩放后仍使用稳定的初始尺寸计算下限', () => {
    const item = createItem({
      binfo: { left: 0, top: 0, width: 60, height: 40, angle: 0 },
      resize_base_size: { width: 120, height: 80 }
    });

    expect(getResizeMinSize(item)).toEqual({ width: 60, height: 40 });
    expect(clampResizeDimension(12, getResizeMinSize(item).width)).toBe(60);
  });

  it('导入旧数据时把当前尺寸直接作为缩放下限', () => {
    const [item] = normalizeResizeBaseSizes([createItem()], true);

    expect(item.resize_base_size).toEqual({ width: 240, height: 160 });
    expect(getResizeMinSize(item)).toEqual({ width: 120, height: 80 });
  });

  it('支持图元自定义更严格的最小比例', () => {
    const item = createItem({
      resize_base_size: { width: 120, height: 80 },
      resize_min_scale: 0.75
    });

    expect(getResizeMinSize(item)).toEqual({ width: 90, height: 60 });
  });

  it('拖拽缩放停在最小宽高', () => {
    const result = getNewStyle(
      'br',
      { width: 120, height: 80, centerX: 60, centerY: 40, rotateAngle: 0 },
      -100,
      -70,
      undefined,
      60,
      40
    );

    expect(result.size).toEqual({ width: 60, height: 40 });
  });

  it('等比缩放按更严格的一边限制整体比例', () => {
    const result = getNewStyle(
      'br',
      { width: 200, height: 100, centerX: 100, centerY: 50, rotateAngle: 0 },
      -190,
      -90,
      2,
      80,
      60
    );

    expect(result.size).toEqual({ width: 120, height: 60 });
  });
});
