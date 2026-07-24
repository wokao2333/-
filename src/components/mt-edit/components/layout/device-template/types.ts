import type { DevicePointRow, DeviceTypeRow } from '@/database';

export type { DevicePointRow, DeviceTypeRow };

/** 设备模板保存后通知画布同步的最新测点配置 */
export interface DeviceTemplateSelectionChange {
  deviceType: string;
  points: DevicePointRow[];
}
