import { describe, expect, it } from 'vitest';
import { genExportJson, useExportJsonToDoneJson } from '../composables';
import type { IExportJson } from '../components/types';
import type { IDoneJson } from './types';
import { createDefaultCanvasCfg, normalizeKeyboardMoveDistance } from './global';

describe('default canvas config', () => {
  it('uses the microgrid content viewport size', () => {
    expect(createDefaultCanvasCfg()).toMatchObject({
      width: 1280,
      height: 750,
      keyboard_move_distance: 0.5
    });
  });

  it('keeps the saved size when importing an existing diagram', () => {
    const exportJson: IExportJson = {
      canvasCfg: {
        ...createDefaultCanvasCfg(),
        height: 800
      },
      gridCfg: {
        enabled: false,
        align: true,
        size: 10
      },
      json: []
    };

    const { canvasCfg } = useExportJsonToDoneJson(exportJson);

    expect(canvasCfg).toMatchObject({
      width: 1280,
      height: 800
    });
  });

  it('normalizes keyboard move distance to one decimal place with a positive fallback', () => {
    expect(normalizeKeyboardMoveDistance(1.26)).toBe(1.3);
    expect(normalizeKeyboardMoveDistance(undefined)).toBe(0.5);
    expect(normalizeKeyboardMoveDistance(0)).toBe(0.5);
  });

  it('exports nested group items with flat props and without editor-only SVG symbols', () => {
    const group: IDoneJson = {
      id: 'group-1',
      title: '组合',
      type: 'group',
      binfo: { left: 10, top: 20, width: 200, height: 100, angle: 0 },
      resize: true,
      rotate: true,
      lock: false,
      active: true,
      hide: false,
      props: {},
      common_animations: { val: '', delay: 'delay-0s', speed: 'slow', repeat: 'infinite' },
      events: [],
      tag: 'group',
      children: [
        {
          id: 'line-1',
          title: '垂直线',
          type: 'sys-line',
          binfo: { left: 10, top: 0, width: 0, height: 100, angle: 0 },
          resize: false,
          rotate: false,
          lock: false,
          active: true,
          hide: false,
          props: {
            stroke: { title: '线条颜色', type: 'color', val: '#ff0000' },
            point_position: {
              title: '点坐标',
              type: 'jsonEdit',
              val: [
                { x: 0, y: 0 },
                { x: 0, y: 100 }
              ]
            }
          },
          common_animations: { val: '', delay: 'delay-0s', speed: 'slow', repeat: 'infinite' },
          events: [],
          tag: 'sys-line-vertical'
        },
        {
          id: 'svg-1',
          title: '光伏板',
          type: 'svg',
          binfo: { left: 40, top: 20, width: 30, height: 30, angle: 0 },
          resize: true,
          rotate: true,
          lock: false,
          active: true,
          hide: false,
          props: { fill: { title: '填充色', type: 'color', val: '#ff0000' } },
          common_animations: { val: '', delay: 'delay-0s', speed: 'slow', repeat: 'infinite' },
          events: [],
          tag: '光伏板',
          symbol: {
            symbol_id: '光伏板',
            symbol_str: '<symbol id="光伏板" viewBox="0 0 10 10" />',
            width: '10',
            height: '10'
          }
        }
      ]
    };

    const { exportJson } = genExportJson(
      createDefaultCanvasCfg(),
      { enabled: false, align: true, size: 10 },
      [group]
    );
    const exportedGroup = exportJson.json[0];
    const exportedLine = exportedGroup.children?.[0];
    const exportedSvg = exportedGroup.children?.[1];

    expect(exportedLine?.props.stroke).toBe('#ff0000');
    expect(exportedLine?.props.point_position).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 100 }
    ]);
    expect(exportedSvg?.props.fill).toBe('#ff0000');
    expect(exportedSvg).not.toHaveProperty('symbol');
    expect(exportedGroup.active).toBe(false);
  });
});
