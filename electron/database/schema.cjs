const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT,
    address TEXT,
    remark TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS diagrams (
    id TEXT PRIMARY KEY,
    stationId TEXT,
    name TEXT,
    thumbnail TEXT,
    exportJson TEXT,
    boundDeviceCount INTEGER DEFAULT 0,
    unboundDeviceCount INTEGER DEFAULT 0,
    published INTEGER DEFAULT 0,
    createTime INTEGER,
    updateTime INTEGER,
    remark TEXT,
    boundMcuId TEXT,
    boundMcuInfo TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_diagrams_station ON diagrams(stationId)',
  `CREATE TABLE IF NOT EXISTS mcus (
    id TEXT PRIMARY KEY,
    stationId TEXT,
    sn TEXT,
    ip TEXT,
    port TEXT,
    remark TEXT,
    updateTime INTEGER
  )`,
  'CREATE INDEX IF NOT EXISTS idx_mcus_station ON mcus(stationId)',
  `CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT,
    remark TEXT,
    content TEXT,
    itemCount INTEGER,
    createTime INTEGER,
    updateTime INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    device TEXT,
    pointName TEXT,
    innerId TEXT,
    dataType TEXT,
    unit TEXT,
    addrHex TEXT,
    addrDec INTEGER,
    offset INTEGER,
    source4y TEXT,
    pulseFlag TEXT,
    raw TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_points_device ON points(device)',
  'CREATE INDEX IF NOT EXISTS idx_points_innerId ON points(innerId)',
  'CREATE INDEX IF NOT EXISTS idx_points_addrDec ON points(addrDec)',
  `CREATE TABLE IF NOT EXISTS device_types (
    name TEXT PRIMARY KEY,
    typeCode INTEGER,
    createTime INTEGER,
    updateTime INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS device_points (
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
  )`,
  'CREATE INDEX IF NOT EXISTS idx_device_points_type ON device_points(deviceType)'
];

function ensureSchema(db) {
  for (const sql of SCHEMA_SQL) {
    db.prepare(sql).run();
  }
  // 兼容旧库：diagrams 表早期版本没有 remark / 设备绑定统计列 / 发布状态列，按需补齐
  try {
    const cols = db.pragma('table_info(diagrams)').map((c) => c.name);
    if (!cols.includes('remark')) {
      db.prepare('ALTER TABLE diagrams ADD COLUMN remark TEXT').run();
    }
    if (!cols.includes('boundDeviceCount')) {
      db.prepare('ALTER TABLE diagrams ADD COLUMN boundDeviceCount INTEGER DEFAULT 0').run();
    }
    if (!cols.includes('unboundDeviceCount')) {
      db.prepare('ALTER TABLE diagrams ADD COLUMN unboundDeviceCount INTEGER DEFAULT 0').run();
    }
    if (!cols.includes('published')) {
      db.prepare('ALTER TABLE diagrams ADD COLUMN published INTEGER DEFAULT 0').run();
    }
    // 补齐一次图与 MCU 关联绑定所需字段：绑定的 MCU ID 及其详细信息快照
    if (!cols.includes('boundMcuId')) {
      db.prepare('ALTER TABLE diagrams ADD COLUMN boundMcuId TEXT').run();
    }
    if (!cols.includes('boundMcuInfo')) {
      db.prepare('ALTER TABLE diagrams ADD COLUMN boundMcuInfo TEXT').run();
    }
  } catch (e) {
    console.error('[schema] 迁移 diagrams 列失败', e);
  }
  // 兼容旧库：mcus 表早期仅含 sn / ip / remark，补齐 port，并彻底删除已废弃的 baseUrl
  try {
    const mcuCols = db.pragma('table_info(mcus)').map((c) => c.name);
    if (!mcuCols.includes('port')) {
      db.prepare('ALTER TABLE mcus ADD COLUMN port TEXT').run();
    }
    if (mcuCols.includes('baseUrl')) {
      db.prepare('ALTER TABLE mcus DROP COLUMN baseUrl').run();
    }
  } catch (e) {
    console.error('[schema] 迁移 mcus 列失败', e);
  }
  db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_diagrams_station_published
     ON diagrams(stationId)
     WHERE published = 1`
  ).run();
}

module.exports = {
  ensureSchema
};
