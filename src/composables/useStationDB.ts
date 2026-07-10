import type { Station } from '@/components/mt-edit/components/layout/station-aside/types';
import db from '@/database';

// 兼容旧调用方式；实际数据库实现由 src/database 按运行环境选择。
export function useStationDB() {
  const loadAll = (): Promise<Station[]> => db.station.list();

  return {
    loadAll,
    save: db.station.save,
    remove: db.station.remove,
    clearAll: db.station.clearAll
  };
}
