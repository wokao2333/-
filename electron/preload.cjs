const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  database: {
    station: {
      list: () => invoke('database:station:list'),
      save: (station) => invoke('database:station:save', station),
      remove: (stationId) => invoke('database:station:remove', stationId),
      clearAll: () => invoke('database:station:clear-all')
    },
    mcu: {
      listByStation: (stationId) => invoke('database:mcu:list-by-station', stationId),
      replaceByStation: (stationId, items) =>
        invoke('database:mcu:replace-by-station', stationId, items),
      removeByStation: (stationId) => invoke('database:mcu:remove-by-station', stationId)
    },
    template: {
      list: () => invoke('database:template:list'),
      save: (template) => invoke('database:template:save', template),
      remove: (templateId) => invoke('database:template:remove', templateId)
    },
    customSymbol: {
      list: () => invoke('database:custom-symbol:list'),
      save: (symbol) => invoke('database:custom-symbol:save', symbol),
      remove: (symbolId) => invoke('database:custom-symbol:remove', symbolId),
      removeByCategory: (category) => invoke('database:custom-symbol:remove-by-category', category)
    },
    point: {
      replaceCategory: (category, rows) =>
        invoke('database:point:replace-category', category, rows),
      list: () => invoke('database:point:list'),
      query: (sql, params = []) => invoke('database:point:query', sql, params)
    },
    deviceTemplate: {
      replaceFromRows: (rows) => invoke('database:device-template:replace', rows),
      listDeviceTypes: () => invoke('database:device-template:list-types'),
      listPointsByDevice: (deviceType) =>
        invoke('database:device-template:list-points', deviceType),
      saveSelection: (deviceType, selectedIds) =>
        invoke('database:device-template:save-selection', deviceType, selectedIds)
    },
    project: {
      exportBytes: () => invoke('database:project:export-bytes'),
      importBytes: (bytes) => invoke('database:project:import-bytes', bytes)
    }
  }
});
