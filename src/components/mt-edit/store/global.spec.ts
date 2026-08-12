import { describe, expect, it } from 'vitest';
import { useExportJsonToDoneJson } from '../composables';
import type { IExportJson } from '../components/types';
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
});
