import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import MtPreview from './index.vue';
import type { IExportJson } from '../mt-edit/components/types';

const createExportJson = (): IExportJson => ({
  canvasCfg: {
    width: 1920,
    height: 1080,
    scale: 0.8,
    color: '#000000',
    img: '',
    guide: true,
    adsorp: true,
    adsorp_diff: 3,
    transform_origin: {
      x: 240,
      y: 120
    },
    drag_offset: {
      x: 35,
      y: -20
    }
  },
  gridCfg: {
    enabled: true,
    align: true,
    size: 10
  },
  json: []
});

describe('MtPreview', () => {
  it('moves the saved editor view transform onto the outer stage', async () => {
    const wrapper = mount(MtPreview, {
      props: {
        exportJson: createExportJson()
      },
      global: {
        stubs: {
          RenderCore: true
        }
      }
    });

    await nextTick();

    const stageStyle = wrapper.find('.preview-canvas-stage').attributes('style');
    const canvasStyle = wrapper.find('.canvasArea').attributes('style');

    expect(stageStyle).toContain('width: 1920px');
    expect(stageStyle).toContain('height: 1080px');
    expect(stageStyle).toContain('transform: translate(83px, 4px) scale(0.8)');
    expect(canvasStyle).toContain('width: 1920px');
    expect(canvasStyle).toContain('height: 1080px');
    expect(canvasStyle).not.toContain('transform');

    wrapper.unmount();
  });

  it('zooms only the outer stage and keeps the logical canvas geometry unchanged', async () => {
    const exportJson = createExportJson();
    const originalExportJson = JSON.stringify(exportJson);
    const wrapper = mount(MtPreview, {
      props: {
        exportJson
      },
      global: {
        stubs: {
          RenderCore: true
        }
      }
    });

    await nextTick();
    const canvasStyle = wrapper.find('.canvasArea').attributes('style');
    const stage = wrapper.find('.preview-canvas-stage');

    stage.element.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        ctrlKey: true,
        deltaY: -1,
        clientX: 400,
        clientY: 300
      })
    );
    await nextTick();

    expect(stage.attributes('style')).toContain('scale(0.88)');
    expect(wrapper.find('.canvasArea').attributes('style')).toBe(canvasStyle);
    expect(JSON.stringify(exportJson)).toBe(originalExportJson);

    stage.element.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        ctrlKey: true,
        deltaY: 1,
        clientX: 400,
        clientY: 300
      })
    );
    await nextTick();

    expect(stage.attributes('style')).toContain('transform: translate(83px, 4px) scale(0.8)');
    expect(wrapper.find('.canvasArea').attributes('style')).toBe(canvasStyle);
    expect(JSON.stringify(exportJson)).toBe(originalExportJson);

    wrapper.unmount();
  });
});
