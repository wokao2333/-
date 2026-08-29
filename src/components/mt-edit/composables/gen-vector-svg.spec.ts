import { afterEach, describe, expect, it } from 'vitest';
import { globalStore, createDefaultCanvasCfg } from '../store/global';
import { genVectorSvg } from './gen-vector-svg';
import type { IDoneJson } from '../store/types';

const baseItem = (overrides: Partial<IDoneJson>): IDoneJson => ({
  id: 'item',
  title: 'item',
  type: 'vue',
  binfo: { left: 0, top: 0, width: 100, height: 100, angle: 0 },
  resize: true,
  rotate: true,
  lock: false,
  active: false,
  hide: false,
  props: {},
  common_animations: { val: '', delay: 'delay-0s', speed: 'slow', repeat: 'infinite' },
  events: [],
  ...overrides
});

afterEach(() => {
  globalStore.done_json = [];
  globalStore.canvasCfg = createDefaultCanvasCfg();
});

describe('genVectorSvg', () => {
  it('keeps the source symbol viewBox and makes the use fill the item viewport', () => {
    globalStore.done_json = [
      baseItem({
        type: 'svg',
        id: 'negative-symbol',
        binfo: { left: 10, top: 20, width: 40, height: 80, angle: 0 },
        symbol: {
          symbol_id: 'negative-symbol',
          symbol_str:
            '<symbol id="negative-symbol" viewBox="-30 -30 60 60"><circle r="6" /></symbol>',
          width: '60',
          height: '60'
        }
      })
    ];

    const svg = genVectorSvg();

    expect(svg).toContain('viewBox="-30 -30 60 60"');
    expect(svg).toContain('width="100%" height="100%"');
    expect(svg).toContain('preserveAspectRatio="none"');
  });

  it('converts group child percentages into local pixels', () => {
    const child = baseItem({
      id: 'child',
      type: 'vue',
      binfo: { left: 25, top: 10, width: 50, height: 20, angle: 0 },
      props: { text: { title: 'text', type: 'input', val: 'A' } }
    });
    globalStore.done_json = [
      baseItem({
        id: 'group',
        type: 'group',
        binfo: { left: 100, top: 50, width: 200, height: 100, angle: 0 },
        children: [child]
      })
    ];

    const svg = genVectorSvg();

    expect(svg).toContain('translate(50, 10)');
    expect(svg).not.toContain('translate(25, 10)');
  });

  it('keeps line points local to the line bounding box', () => {
    globalStore.done_json = [
      baseItem({
        id: 'line',
        type: 'sys-line',
        binfo: { left: 40, top: 60, width: 80, height: 0, angle: 0 },
        props: {
          stroke: { title: 'stroke', type: 'color', val: '#f00' },
          'stroke-width': { title: 'stroke-width', type: 'number', val: 2 },
          point_position: {
            title: 'points',
            type: 'jsonEdit',
            val: [
              { x: 0, y: 0 },
              { x: 80, y: 0 }
            ]
          },
          'marker-start': { title: 'marker-start', type: 'switch', val: false },
          'marker-end': { title: 'marker-end', type: 'switch', val: false },
          ani_type: { title: 'ani-type', type: 'select', val: 'none' }
        }
      })
    ];

    const svg = genVectorSvg();

    expect(svg).toContain('translate(40, 60)');
    expect(svg).toContain('M 0 0 L 80 0');
    expect(svg).not.toContain('M 40 60 L 120 60');
  });
});
