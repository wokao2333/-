import { describe, expect, it } from 'vitest';
import type { IDoneJson } from '@/components/mt-edit/store/types';
import { buildDeviceLabelGroup, restoreDeviceFromLabelGroup } from './device-label-group';

const createItem = (
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  device = false
): IDoneJson => ({
  id,
  title: id,
  type: 'svg',
  binfo: { left, top, width, height, angle: 0 },
  resize: true,
  rotate: true,
  lock: false,
  active: true,
  hide: false,
  props: {},
  device,
  common_animations: { val: '', delay: 'delay-0s', speed: 'slow', repeat: 'infinite' },
  events: []
});

describe('设备和名称默认组合', () => {
  it('创建包含设备和 label 的单个设备组合', () => {
    const device = createItem('ATS-1', 100, 200, 80, 100, true);
    const label = createItem('text-1', 200, 230, 120, 40);
    label.type = 'vue';

    const group = buildDeviceLabelGroup(device, label);

    expect(group.type).toBe('group');
    expect(group.device).toBe(true);
    expect(group.deviceLabelGroup).toBe(true);
    expect(group.binfo).toEqual({ left: 100, top: 200, width: 220, height: 100, angle: 0 });
    expect(group.children).toHaveLength(2);
    expect(group.children?.[0].device).toBe(false);
    expect(group.children?.[0].binfo).toMatchObject({ left: 0, top: 0 });
    expect(group.children?.[1].binfo).toMatchObject({
      left: (100 * 100) / 220,
      top: 30
    });
  });

  it('取消组合时把设备绑定还原给设备子项', () => {
    const device = createItem('device-1', 0, 0, 50, 50);
    const label = createItem('label-1', 70, 5, 100, 40);
    const group = buildDeviceLabelGroup(device, label);
    group.deviceBind = {
      deviceId: 'D-1',
      dataKey: '',
      targetAttr: '',
      unit: '',
      deviceType: 'ATS'
    };

    const restored = restoreDeviceFromLabelGroup(group, [device, label]);

    expect(restored[0].device).toBe(true);
    expect(restored[0].deviceBind).toEqual(group.deviceBind);
    expect(restored[1].device).toBe(false);
  });
});
