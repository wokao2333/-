const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow, ipcMain } = require('electron');
const { createSqliteService } = require('./database/sqlite-service.cjs');

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
  ipcMain.handle('database:device-template:save-selection', (_event, deviceType, selectedIds) => {
    try {
      return getSqliteService().deviceTemplate.saveSelection(deviceType, selectedIds);
    } catch (err) {
      console.error('[main] save-selection 失败', deviceType, selectedIds, err);
      throw err;
    }
  });

  ipcMain.handle('database:project:export-bytes', () => getSqliteService().project.exportBytes());
  ipcMain.handle('database:project:import-bytes', (_event, bytes) =>
    getSqliteService().project.importBytes(bytes)
  );
}

// 轮询等待 Vite 开发服务器在 5173 端口就绪，避免 Electron 在服务器未启动时
// 直接 loadURL 触发 ERR_CONNECTION_REFUSED
function waitForDevServer(url, { retries = 60, delay = 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const { hostname, port } = new URL(url);
    let attempts = 0;
    const tryConnect = () => {
      const req = http.get(
        { hostname, port, path: '/', method: 'GET', timeout: 2000 },
        (res) => {
          res.destroy();
          resolve(true);
        }
      );
      req.on('error', () => {
        attempts += 1;
        if (attempts >= retries) {
          reject(new Error(`Vite 开发服务器在 ${retries} 次重试内未就绪（${url}）`));
        } else {
          setTimeout(tryConnect, delay);
        }
      });
      req.on('timeout', () => {
        req.destroy();
        attempts += 1;
        if (attempts >= retries) {
          reject(new Error(`连接 Vite 开发服务器超时（${url}）`));
        } else {
          setTimeout(tryConnect, delay);
        }
      });
    };
    tryConnect();
  });
}

async function createWindow() {
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
    // 等待 Vite 就绪后再加载页面，避免 ERR_CONNECTION_REFUSED
    waitForDevServer(devServerUrl)
      .then(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.loadURL(devServerUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      })
      .catch((err) => {
        console.error('[electron] 无法连接 Vite 开发服务器：', err.message);
        if (mainWindow && !mainWindow.isDestroyed()) {
          const html = `<html><body style="font-family:sans-serif;padding:24px">
            <h2>无法连接开发服务器</h2>
            <p>${err.message}</p>
            <p>请确认已运行 <code>pnpm run vite:serve</code>，且端口 5173 未被占用或被防火墙拦截。</p>
          </body></html>`;
          mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        }
      });
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
