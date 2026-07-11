// 浏览器内 SQLite（基于 sql.js WASM）统一存储层。
// - 所有业务数据（场站 / 一次图 / MCU / 模版 / 点表）统一存放在单个 .sqlite 库中。
// - 通过把 .sqlite 二进制落盘到 OPFS 真实文件实现持久化，刷新浏览器不会丢失。
// - 支持把整个库导出为 .sqlite 文件、再导入，便于多人交接与备份。
// - 首次启动会自动把旧的 IndexedDB 数据迁移进来。

import { ref } from 'vue';
import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { loadBytes, saveBytes } from './opfs-store';

/** 数据版本号：导入/迁移后自增，组件可 watch 它来重新加载列表 */
export const dbRevision = ref(0);
function bumpRevision() {
  dbRevision.value++;
}

let SQL: SqlJsStatic | null = null;
let dbPromise: Promise<Database> | null = null;
let currentDB: Database | null = null;

async function initSql(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  return SQL;
}

function migrate(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY, name TEXT, address TEXT, remark TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS diagrams (
    id TEXT PRIMARY KEY, stationId TEXT, name TEXT, thumbnail TEXT, exportJson TEXT,
    boundDeviceCount INTEGER DEFAULT 0, unboundDeviceCount INTEGER DEFAULT 0,
    published INTEGER DEFAULT 0, createTime INTEGER, updateTime INTEGER, remark TEXT,
    boundMcuId TEXT, boundMcuInfo TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_diagrams_station ON diagrams(stationId)`);
  db.run(`CREATE TABLE IF NOT EXISTS mcus (
    id TEXT PRIMARY KEY, stationId TEXT, sn TEXT, ip TEXT, port TEXT, remark TEXT, updateTime INTEGER
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mcus_station ON mcus(stationId)`);
  db.run(`CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY, name TEXT, remark TEXT, content TEXT, itemCount INTEGER, createTime INTEGER, updateTime INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT, device TEXT, pointName TEXT, innerId TEXT,
    dataType TEXT, unit TEXT, addrHex TEXT, addrDec INTEGER,
    offset INTEGER, source4y TEXT, pulseFlag TEXT, raw TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_points_device ON points(device)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_points_innerId ON points(innerId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_points_addrDec ON points(addrDec)`);
  db.run(`CREATE TABLE IF NOT EXISTS device_types (
    name TEXT PRIMARY KEY,
    typeCode INTEGER,
    createTime INTEGER,
    updateTime INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS device_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceType TEXT,
    typeCode INTEGER,
    innerId TEXT,
    pointName TEXT,
    displayName TEXT,
    dataType TEXT,
    unit TEXT,
    defaultSelected INTEGER DEFAULT 0,
    sortOrder INTEGER DEFAULT 0,
    selected INTEGER DEFAULT 1,
    raw TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_device_points_type ON device_points(deviceType)`);
  // 旧库可能缺少后续补充的 diagrams 列，这里按需补齐。
  ensureDiagramColumns(db);
  // 旧库可能缺少后续补充的 mcus 连接字段（port / baseUrl），这里按需补齐。
  ensureMcuColumns(db);
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_diagrams_station_published
     ON diagrams(stationId)
     WHERE published = 1`
  );
}

// 兼容旧库：diagrams 表在较早版本没有 remark / 设备绑定统计列 / 发布状态列，
// 这里在迁移阶段补齐，避免写入时报缺列。
function ensureDiagramColumns(db: Database) {
  try {
    const info = db.exec('PRAGMA table_info(diagrams)');
    const cols = info.length ? info[0].values.map((r) => String(r[1])) : [];
    if (!cols.includes('remark')) {
      db.run('ALTER TABLE diagrams ADD COLUMN remark TEXT');
    }
    if (!cols.includes('boundDeviceCount')) {
      db.run('ALTER TABLE diagrams ADD COLUMN boundDeviceCount INTEGER DEFAULT 0');
    }
    if (!cols.includes('unboundDeviceCount')) {
      db.run('ALTER TABLE diagrams ADD COLUMN unboundDeviceCount INTEGER DEFAULT 0');
    }
    if (!cols.includes('published')) {
      db.run('ALTER TABLE diagrams ADD COLUMN published INTEGER DEFAULT 0');
    }
    // 补齐一次图与 MCU 关联绑定所需字段：绑定的 MCU ID 及其详细信息快照
    if (!cols.includes('boundMcuId')) {
      db.run('ALTER TABLE diagrams ADD COLUMN boundMcuId TEXT');
    }
    if (!cols.includes('boundMcuInfo')) {
      db.run('ALTER TABLE diagrams ADD COLUMN boundMcuInfo TEXT');
    }
  } catch (e) {
    console.error('[sqlite] 迁移 diagrams 列失败', e);
  }
}

// 兼容旧库：mcus 表早期仅含 sn / ip / remark，这里补齐 port（通信端口），
// 并清除已废弃的 baseUrl（接口基地址）列，使连接信息（SN / IP / 端口）完整沉淀在 MCU 实体上。
function ensureMcuColumns(db: Database) {
  try {
    const info = db.exec('PRAGMA table_info(mcus)');
    const cols = info.length ? info[0].values.map((r) => String(r[1])) : [];
    if (!cols.includes('port')) {
      db.run('ALTER TABLE mcus ADD COLUMN port TEXT');
    }
    // 彻底删除已废弃的 baseUrl（接口基地址）存储字段
    if (cols.includes('baseUrl')) {
      db.run('ALTER TABLE mcus DROP COLUMN baseUrl');
    }
  } catch (e) {
    console.error('[sqlite] 迁移 mcus 列失败', e);
  }
}

function persistNow(db: Database): Promise<void> {
  const out = db.export().slice();
  return saveBytes(out.buffer as ArrayBuffer);
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
/** 写操作后调用：防抖地把整个库落盘到 OPFS 文件 */
export function persist() {
  if (persistTimer != null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (currentDB) {
      persistNow(currentDB).catch((e) => console.error('[sqlite] 持久化失败', e));
    }
  }, 200);
}

async function migrateLegacy(db: Database): Promise<boolean> {
  const readStore = <T>(store: string): Promise<T[]> =>
    new Promise((resolve) => {
      const req = indexedDB.open('maotu-stations');
      req.onsuccess = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(store)) {
          idb.close();
          resolve([]);
          return;
        }
        const tx = idb.transaction(store, 'readonly');
        const get = tx.objectStore(store).getAll();
        get.onsuccess = () => {
          idb.close();
          resolve((get.result as T[]) || []);
        };
        get.onerror = () => {
          idb.close();
          resolve([]);
        };
      };
      req.onerror = () => resolve([]);
    });

  const stations = await readStore<any>('stations');
  const mcus = await readStore<any>('mcus');
  const templates = await readStore<any>('templates');
  if (!stations.length && !mcus.length && !templates.length) return false;

  // sql.js 的 stmt.run / bind 不接受 undefined（只接受 number/string/null/Uint8Array），
  // 旧 IndexedDB 数据可能含 undefined 字段，需统一清洗为 null，否则会抛
  // "tried to bind a value of an unknown type (undefined)"。
  const clean = (v: unknown): SqlValue => (v === undefined ? null : (v as SqlValue));
  const cleanRow = (row: unknown[]): SqlValue[] => row.map(clean);

  try {
    db.run('BEGIN');
    const insStation = db.prepare(
      'INSERT OR REPLACE INTO stations (id,name,address,remark) VALUES (?,?,?,?)'
    );
    const insDiagram = db.prepare(
      'INSERT OR REPLACE INTO diagrams (id,stationId,name,thumbnail,exportJson,createTime,updateTime) VALUES (?,?,?,?,?,?,?)'
    );
    for (const s of stations) {
      insStation.run(cleanRow([s.id, s.name, s.address, s.remark]));
      for (const d of s.diagrams || []) {
        insDiagram.run(
          cleanRow([
            d.id,
            s.id,
            d.name,
            d.thumbnail,
            JSON.stringify(d.exportJson ?? {}),
            d.createTime,
            d.updateTime
          ])
        );
      }
    }
    insStation.free();
    insDiagram.free();

    const insMcu = db.prepare(
      'INSERT OR REPLACE INTO mcus (id,stationId,sn,ip,port,remark,updateTime) VALUES (?,?,?,?,?,?,?)'
    );
    for (const m of mcus) {
      insMcu.run(cleanRow([m.id, m.stationId, m.sn, m.ip, m.port, m.remark, m.updateTime]));
    }
    insMcu.free();

    const insTpl = db.prepare(
      'INSERT OR REPLACE INTO templates (id,name,remark,content,itemCount,createTime,updateTime) VALUES (?,?,?,?,?,?,?)'
    );
    for (const t of templates) {
      insTpl.run(
        cleanRow([
          t.id,
          t.name,
          t.remark,
          JSON.stringify(t.content ?? {}),
          t.itemCount,
          t.createTime,
          t.updateTime
        ])
      );
    }
    insTpl.free();

    db.run('COMMIT');
  } catch (e) {
    // 迁移失败时回滚，避免半截事务污染后续数据库操作
    try {
      db.run('ROLLBACK');
    } catch {
      /* 已无事务则忽略 */
    }
    throw e;
  }
  await persistNow(db);
  return true;
}

async function initDB(): Promise<Database> {
  const sql = await initSql();
  const buf = await loadBytes();
  const database = buf ? new sql.Database(new Uint8Array(buf)) : new sql.Database();
  migrate(database);
  currentDB = database;
  if (!buf) {
    const migrated = await migrateLegacy(database);
    if (migrated) bumpRevision();
  }
  return database;
}

export function getDB(): Promise<Database> {
  if (!dbPromise) dbPromise = initDB();
  return dbPromise;
}

/** 导出整个数据库为 Blob（.sqlite 文件），用于下载 */
export async function exportFile(): Promise<Blob> {
  const database = await getDB();
  const out = database.export().slice();
  return new Blob([out], { type: 'application/x-sqlite3' });
}

/** 用上传的 .sqlite 文件替换当前数据库，并重新持久化 */
export async function importFile(file: File): Promise<void> {
  const arr = new Uint8Array(await file.arrayBuffer());
  const sql = await initSql();
  const database = new sql.Database(arr);
  migrate(database);
  currentDB = database;
  dbPromise = Promise.resolve(database);
  await persistNow(database);
  bumpRevision();
}
