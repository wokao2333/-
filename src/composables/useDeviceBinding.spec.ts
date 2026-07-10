import { describe, expect, it } from 'vitest';
import type { IExportJson } from '@/components/mt-edit/components/types';
import { collectDeviceBindingStats } from './useDeviceBinding';

describe('collectDeviceBindingStats', () => {
  it('counts bound and unbound device graphics recursively', () => {
    const exportJson = {
      json: [
        {
          id: 'battery',
          title: '储能电池',
          device: true,
          deviceBind: { deviceId: '并网点上侧', dataKey: 'PhV_phsA' }
        },
        {
          id: 'pv',
          title: '光伏板',
          device: true,
          deviceBind: { deviceId: '', dataKey: '' }
        },
        {
          id: 'group',
          title: '组合',
          children: [
            {
              id: 'nested-device',
              title: '嵌套设备',
              device: true,
              deviceBind: { deviceId: '   ', dataKey: 'A_phsA' }
            },
            {
              id: 'kv',
              title: '键值对',
              deviceBind: { deviceId: '并网点上侧', dataKey: 'TotW' }
            }
          ]
        }
      ]
    } as unknown as IExportJson;

    expect(collectDeviceBindingStats(exportJson)).toEqual({
      boundDeviceCount: 1,
      unboundDeviceCount: 2
    });
  });
});
