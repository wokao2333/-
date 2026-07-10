import type { McuItem } from '@/components/mt-edit/components/layout/station-aside/types';
import db from '@/database';

// 兼容旧调用方式；实际数据库实现由 src/database 按运行环境选择。
export function useMcuDB() {
  const loadByStation = (stationId: string): Promise<McuItem[]> => db.mcu.listByStation(stationId);

  return {
    loadByStation,
    replaceByStation: db.mcu.replaceByStation,
    removeByStation: db.mcu.removeByStation
  };
}
