import { describe, expect, it } from 'vitest';
import type { IDoneJson } from '@/components/mt-edit/store/types';
import { collectResizeVisualMetrics, scaleResizeVisualMetrics } from './text-resize';

const createItem = (overrides: Partial<IDoneJson>): IDoneJson => ({
  id: 'item',
  title: '图元',
  type: 'svg',
  binfo: { left: 0, top: 0, width: 100, height: 100, angle: 0 },
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

const createText = (id: string, font_size: number, vertical = false) =>
  createItem({
    id,
    type: 'vue',
    tag: 'text-vue',
    props: {
      fontSize: { title: '文字大小', type: 'number', val: font_size },
      vertical: { title: '竖排展示', type: 'switch', val: vertical }
    }
  });

describe('组合文字缩放', () => {
  it('横排文字按组合高度比例缩放且不累乘', () => {
    const text = createText('text', 30);
    const snapshot = collectResizeVisualMetrics(text);
    const enlarged = scaleResizeVisualMetrics(text, snapshot, 2, 2);
    const reduced = scaleResizeVisualMetrics(enlarged, snapshot, 0.5, 0.5);

    expect(enlarged.props.fontSize.val).toBe(60);
    expect(reduced.props.fontSize.val).toBe(15);
    expect(text.props.fontSize.val).toBe(30);
  });

  it('递归缩放组合和嵌套组合中的横排、竖排文字', () => {
    const svg = createItem({ id: 'svg' });
    const horizontal_text = createText('horizontal-text', 20);
    const vertical_text = createText('vertical-text', 16, true);
    const nested_group = createItem({
      id: 'nested-group',
      type: 'group',
      children: [vertical_text]
    });
    const group = createItem({
      id: 'group',
      type: 'group',
      children: [svg, horizontal_text, nested_group]
    });

    const scaled = scaleResizeVisualMetrics(group, collectResizeVisualMetrics(group), 3, 2);

    expect(scaled.children?.[0]).toBe(svg);
    expect(scaled.children?.[1].props.fontSize.val).toBe(40);
    expect(scaled.children?.[2].children?.[0].props.fontSize.val).toBe(48);
  });

  it('等比缩放键值对的字号、列宽、单位间距和内边距', () => {
    const kv = createItem({
      id: 'kv',
      type: 'vue',
      tag: 'kv-vue',
      props: {
        fontSize: { title: '默认文字大小', type: 'number', val: 18 },
        labelFontSize: { title: '键名字体大小', type: 'number', val: 18 },
        valueFontSize: { title: '键值字体大小', type: 'number', val: 22 },
        unitFontSize: { title: '单位字体大小', type: 'number', val: 14 },
        labelWidth: { title: '键名宽度', type: 'number', val: 50 },
        valueWidth: { title: '键值宽度', type: 'number', val: 72 },
        unitWidth: { title: '单位宽度', type: 'number', val: 20 },
        unitGap: { title: '单位左间距', type: 'number', val: 12 },
        paddingX: { title: '水平内边距', type: 'number', val: 10, disabled: true },
        paddingY: { title: '垂直内边距', type: 'number', val: 6, disabled: true }
      }
    });

    const scaled = scaleResizeVisualMetrics(kv, collectResizeVisualMetrics(kv), 2, 2);

    expect(scaled.props.fontSize.val).toBe(36);
    expect(scaled.props.labelFontSize.val).toBe(36);
    expect(scaled.props.valueFontSize.val).toBe(44);
    expect(scaled.props.unitFontSize.val).toBe(28);
    expect(scaled.props.labelWidth.val).toBe(100);
    expect(scaled.props.valueWidth.val).toBe(144);
    expect(scaled.props.unitWidth.val).toBe(40);
    expect(scaled.props.unitGap.val).toBe(24);
    expect(scaled.props.paddingX.val).toBe(20);
    expect(scaled.props.paddingY.val).toBe(12);
  });

  it('兼容没有内边距配置的旧键值对数据', () => {
    const kv = createItem({
      id: 'legacy-kv',
      type: 'vue',
      tag: 'kv-vue',
      props: {}
    });

    const scaled = scaleResizeVisualMetrics(kv, collectResizeVisualMetrics(kv), 0.5, 0.5);

    expect(scaled.props.paddingX.val).toBe(5);
    expect(scaled.props.paddingY.val).toBe(3);
    expect(scaled.props.paddingX.disabled).toBe(true);
    expect(scaled.props.paddingY.disabled).toBe(true);
  });
});

describe('组合线条缩放', () => {
  it.each([
    {
      title: '水平线',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      expected: [
        { x: 0, y: 0 },
        { x: 50, y: 0 }
      ]
    },
    {
      title: '垂直线',
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 100 }
      ],
      expected: [
        { x: 0, y: 0 },
        { x: 0, y: 25 }
      ]
    }
  ])('$title 的端点坐标和线宽随组合同步缩放', ({ points, expected }) => {
    const line = createItem({
      id: 'line',
      type: 'sys-line',
      props: {
        'stroke-width': { title: '线条宽度', type: 'number', val: 4 },
        point_position: { title: '点坐标', type: 'jsonEdit', val: points }
      }
    });
    const group = createItem({ id: 'group', type: 'group', children: [line] });
    const snapshot = collectResizeVisualMetrics(group);
    const scaled = scaleResizeVisualMetrics(group, snapshot, 0.5, 0.25);
    const restored = scaleResizeVisualMetrics(scaled, snapshot, 1, 1);

    expect(scaled.children?.[0].props.point_position.val).toEqual(expected);
    expect(scaled.children?.[0].props['stroke-width'].val).toBe(1);
    expect(restored.children?.[0].props.point_position.val).toEqual(points);
    expect(restored.children?.[0].props['stroke-width'].val).toBe(4);
  });

  it.each([
    ['busbar-10kv', 18],
    ['busbar-400v', 4],
    ['busbar-600v', 10]
  ])('%s 的线宽、标签字号和间距随组合同步缩放', (tag, stroke_width) => {
    const busbar = createItem({
      id: tag,
      type: 'vue',
      tag,
      props: {
        strokeWidth: { title: '线条粗细', type: 'number', val: stroke_width },
        fontSize: { title: '标签大小', type: 'number', val: 20 },
        labelGap: { title: '标签间距', type: 'number', val: 12 }
      }
    });
    const group = createItem({ id: 'group', type: 'group', children: [busbar] });
    const scaled = scaleResizeVisualMetrics(group, collectResizeVisualMetrics(group), 0.5, 0.5);

    expect(scaled.children?.[0].props.strokeWidth.val).toBe(stroke_width / 2);
    expect(scaled.children?.[0].props.fontSize.val).toBe(10);
    expect(scaled.children?.[0].props.labelGap.val).toBe(6);
  });
});
