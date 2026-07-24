import type { DatabaseService, ElectronDatabaseBridge } from './types';

function getBridge(): ElectronDatabaseBridge {
  const bridge = window.api?.database;
  if (!bridge) {
    throw new Error('Electron database bridge is not available');
  }
  return bridge;
}

export function hasElectronDatabaseBridge(): boolean {
  return Boolean(window.api?.database);
}

/**
 * Vue 的 reactive/ref 对象（Proxy）无法被 IPC 的结构化克隆算法序列化，
 * 直接传给 ipcRenderer.invoke 会抛 "An object could not be cloned"。
 * Station/Diagram/McuItem 等数据本身都是 JSON 可序列化的，
 * 这里通过 JSON 深拷贝把响应式代理剥离成纯普通对象后再过桥。
 * 注意：project.importBytes 接收的是 Uint8Array 二进制，不能走 JSON 克隆，需跳过。
 */
function toPlain<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export const electronDatabase: DatabaseService = {
  runtime: 'electron',
  station: {
    list: () => getBridge().station.list(),
    save: (station) => getBridge().station.save(toPlain(station)),
    remove: (stationId) => getBridge().station.remove(stationId),
    clearAll: () => getBridge().station.clearAll()
  },
  mcu: {
    listByStation: (stationId) => getBridge().mcu.listByStation(stationId),
    replaceByStation: (stationId, items) =>
      getBridge().mcu.replaceByStation(stationId, toPlain(items)),
    removeByStation: (stationId) => getBridge().mcu.removeByStation(stationId)
  },
  template: {
    list: () => getBridge().template.list(),
    save: (template) => getBridge().template.save(toPlain(template)),
    remove: (templateId) => getBridge().template.remove(templateId)
  },
  point: {
    replaceCategory: (category, rows) => getBridge().point.replaceCategory(category, toPlain(rows)),
    list: () => getBridge().point.list(),
    query: (sql, params = []) => getBridge().point.query(sql, toPlain(params))
  },
  deviceTemplate: {
    replaceFromRows: (rows) => getBridge().deviceTemplate.replaceFromRows(toPlain(rows)),
    listDeviceTypes: () => getBridge().deviceTemplate.listDeviceTypes(),
    listPointsByDevice: (deviceType) => getBridge().deviceTemplate.listPointsByDevice(deviceType),
    saveSelection: (deviceType, selectedIds) =>
      getBridge().deviceTemplate.saveSelection(deviceType, toPlain(selectedIds))
  },
  project: {
    async exportFile() {
      const bytes = await getBridge().project.exportBytes();
      return new Blob([bytes], { type: 'application/x-sqlite3' });
    },
    async importFile(file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await getBridge().project.importBytes(bytes);
    }
  }
};
