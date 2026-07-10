const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { createSqliteService } = require('./database/sqlite-service.cjs');
const XLSX = require('xlsx');

// 解析「设备类型-点」Excel（按绝对路径）。单 Sheet，表头：
// 类型 / 类型名称 / 属性标识 / 点名称 / 展示名称 / 数值类型 / 单位 / 是否默认选中 / 排序
function parseDeviceXlsxFile(absPath) {
  const wb = XLSX.readFile(absPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  const headerIdx = aoa.findIndex(
    (r) => r.includes('类型名称') && r.includes('属性标识')
  );
  if (headerIdx < 0) return [];
  const headers = aoa[headerIdx].map((c) => String(c).trim());
  const col = (name) => headers.indexOf(name);
  const get = (row, name) => {
    const idx = col(name);
    return idx >= 0 ? String(row[idx] ?? '').trim() : '';
  };
  const rows = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i];
    const deviceType = get(row, '类型名称');
    const innerId = get(row, '属性标识');
    const pointName = get(row, '点名称');
    if (!deviceType || (!pointName && !innerId)) continue;
    rows.push({
      typeCode: Number(get(row, '类型')) || 0,
      deviceType,
      innerId,
      pointName,
      displayName: get(row, '展示名称'),
      dataType: get(row, '数值类型'),
      unit: get(row, '单位'),
      defaultSelected: Number(get(row, '是否默认选中')) ? 1 : 0,
      sortOrder: Number(get(row, '排序')) || 0
    });
  }
  return rows;
}

let mainWindow = null;
let sqliteService = null;

function getSqliteService() {
  if (!sqliteService) {
    sqliteService = createSqliteService({
      dbPath: path.join(app.getPath('userData'), 'project.sqlite')
    });
  }
  return sqliteService;
}

function registerDatabaseIpc() {
  ipcMain.handle('database:station:list', () => getSqliteService().station.list());
  ipcMain.handle('database:station:save', (_event, station) =>
    getSqliteService().station.save(station)
  );
  ipcMain.handle('database:station:remove', (_event, stationId) =>
    getSqliteService().station.remove(stationId)
  );
  ipcMain.handle('database:station:clear-all', () => getSqliteService().station.clearAll());

  ipcMain.handle('database:mcu:list-by-station', (_event, stationId) =>
    getSqliteService().mcu.listByStation(stationId)
  );
  ipcMain.handle('database:mcu:replace-by-station', (_event, stationId, items) =>
    getSqliteService().mcu.replaceByStation(stationId, items)
  );
  ipcMain.handle('database:mcu:remove-by-station', (_event, stationId) =>
    getSqliteService().mcu.removeByStation(stationId)
  );

  ipcMain.handle('database:template:list', () => getSqliteService().template.list());
  ipcMain.handle('database:template:save', (_event, template) =>
    getSqliteService().template.save(template)
  );
  ipcMain.handle('database:template:remove', (_event, templateId) =>
    getSqliteService().template.remove(templateId)
  );

  ipcMain.handle('database:point:replace-category', (_event, category, rows) =>
    getSqliteService().point.replaceCategory(category, rows)
  );
  ipcMain.handle('database:point:list', () => getSqliteService().point.list());
  ipcMain.handle('database:point:query', (_event, sql, params) =>
    getSqliteService().point.query(sql, params)
  );

  ipcMain.handle('database:device-template:replace', (_event, rows) =>
    getSqliteService().deviceTemplate.replaceFromRows(rows)
  );
  ipcMain.handle('database:device-template:list-types', () =>
    getSqliteService().deviceTemplate.listDeviceTypes()
  );
  ipcMain.handle('database:device-template:list-points', (_event, deviceType) =>
    getSqliteService().deviceTemplate.listPointsByDevice(deviceType)
  );
  ipcMain.handle('database:device-template:save-selection', (_event, deviceType, selectedIds) =>
    getSqliteService().deviceTemplate.saveSelection(deviceType, selectedIds)
  );
  // 按绝对路径解析「设备类型-点」Excel 并导入（仅在 Electron 桌面端可用）
  ipcMain.handle('database:device-template:import-from-path', (_event, absPath) => {
    const service = getSqliteService();
    const rows = parseDeviceXlsxFile(absPath);
    service.deviceTemplate.replaceFromRows(rows);
    return { count: rows.length };
  });

  ipcMain.handle('database:project:export-bytes', () => getSqliteService().project.exportBytes());
  ipcMain.handle('database:project:import-bytes', (_event, bytes) =>
    getSqliteService().project.importBytes(bytes)
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  registerDatabaseIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  sqliteService?.close();
});
