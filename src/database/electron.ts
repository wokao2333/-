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

export const electronDatabase: DatabaseService = {
  runtime: 'electron',
  station: {
    list: () => getBridge().station.list(),
    save: (station) => getBridge().station.save(station),
    remove: (stationId) => getBridge().station.remove(stationId),
    clearAll: () => getBridge().station.clearAll()
  },
  mcu: {
    listByStation: (stationId) => getBridge().mcu.listByStation(stationId),
    replaceByStation: (stationId, items) => getBridge().mcu.replaceByStation(stationId, items),
    removeByStation: (stationId) => getBridge().mcu.removeByStation(stationId)
  },
  template: {
    list: () => getBridge().template.list(),
    save: (template) => getBridge().template.save(template),
    remove: (templateId) => getBridge().template.remove(templateId)
  },
  point: {
    replaceCategory: (category, rows) => getBridge().point.replaceCategory(category, rows),
    list: () => getBridge().point.list(),
    query: (sql, params = []) => getBridge().point.query(sql, params)
  },
  deviceTemplate: {
    replaceFromRows: (rows) => getBridge().deviceTemplate.replaceFromRows(rows),
    listDeviceTypes: () => getBridge().deviceTemplate.listDeviceTypes(),
    listPointsByDevice: (deviceType) => getBridge().deviceTemplate.listPointsByDevice(deviceType),
    saveSelection: (deviceType, selectedIds) =>
      getBridge().deviceTemplate.saveSelection(deviceType, selectedIds)
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
