import { ref } from 'vue';
import { useDeviceTemplateDB } from './useDeviceTemplateDB';
import type { DeviceTypeRow } from '@/database';

// 模块级单例：设备类型列表在应用内只应存在一份共享响应式状态。
// 「设备模板库」负责导入/写入本地 SQLite，绑定面板负责读取并渲染「设备类型」下拉。
// 两者若各自维护独立 ref，导入后仅导入方会刷新，绑定下拉将一直为空（见缺陷单）。
// 改用共享单例后，任意一方调用 loadDeviceTypes 都会同步更新所有消费方。
const deviceTypes = ref<DeviceTypeRow[]>([]);
const deviceTypesLoaded = ref(false);
const db = useDeviceTemplateDB();

export function useDeviceTypes() {
  const loadDeviceTypes = async () => {
    try {
      deviceTypes.value = await db.listDeviceTypes();
      deviceTypesLoaded.value = true;
    } catch (e) {
      console.error('[useDeviceTypes] 加载设备类型失败', e);
      deviceTypes.value = [];
    }
  };

  return { deviceTypes, deviceTypesLoaded, loadDeviceTypes };
}
