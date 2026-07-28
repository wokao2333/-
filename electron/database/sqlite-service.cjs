const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { ensureSchema } = require('./schema.cjs');

function parseJson(value, fallback = {}) {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function assertSelectQuery(sql) {
  if (!/^\s*select\b/i.test(sql)) {
    throw new Error('Only SELECT queries are allowed from the renderer');
  }
}

function removeSidecarFiles(dbPath) {
  for (const suffix of ['-wal', '-shm']) {
    const file = `${dbPath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

class SqliteService {
  constructor(options) {
    this.dbPath = options.dbPath;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.open();
  }

  open() {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    ensureSchema(this.db);
  }

  close() {
    if (!this.db?.open) return;
    this.db.pragma('wal_checkpoint(FULL)');
    this.db.close();
  }

  station = {
    list: () => {
      const stations = this.db
        .prepare('SELECT id,name,address,remark FROM stations')
        .all();
      const diagrams = this.db
        .prepare(
          'SELECT id,stationId,name,thumbnail,exportJson,boundDeviceCount,unboundDeviceCount,published,createTime,updateTime,remark,boundMcuId,boundMcuInfo FROM diagrams'
        )
        .all();
      const diagramMap = new Map();

      for (const diagram of diagrams) {
        const list = diagramMap.get(diagram.stationId) ?? [];
        list.push({
          id: diagram.id,
          name: diagram.name,
          remark: diagram.remark || '',
          thumbnail: diagram.thumbnail,
          exportJson: parseJson(diagram.exportJson),
          boundDeviceCount: Number(diagram.boundDeviceCount) || 0,
          unboundDeviceCount: Number(diagram.unboundDeviceCount) || 0,
          published: Boolean(Number(diagram.published)),
          createTime: diagram.createTime,
          updateTime: diagram.updateTime,
          boundMcuId: diagram.boundMcuId || '',
          boundMcuInfo: parseJson(diagram.boundMcuInfo, null)
        });
        diagramMap.set(diagram.stationId, list);
      }

      return stations.map((station) => ({
        ...station,
        diagrams: diagramMap.get(station.id) ?? []
      }));
    },

    save: (station) => {
      const tx = this.db.transaction(() => {
        this.db
          .prepare(
            'INSERT OR REPLACE INTO stations (id,name,address,remark) VALUES (?,?,?,?)'
          )
          .run(station.id, station.name, station.address, station.remark ?? '');
        this.db.prepare('DELETE FROM diagrams WHERE stationId = ?').run(station.id);

        const insertDiagram = this.db.prepare(
          'INSERT INTO diagrams (id,stationId,name,thumbnail,exportJson,boundDeviceCount,unboundDeviceCount,published,createTime,updateTime,remark,boundMcuId,boundMcuInfo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        for (const diagram of station.diagrams ?? []) {
          insertDiagram.run(
            diagram.id,
            station.id,
            diagram.name,
            diagram.thumbnail,
            JSON.stringify(diagram.exportJson ?? {}),
            diagram.boundDeviceCount ?? 0,
            diagram.unboundDeviceCount ?? 0,
            diagram.published ? 1 : 0,
            diagram.createTime,
            diagram.updateTime,
            diagram.remark ?? '',
            diagram.boundMcuId ?? '',
            diagram.boundMcuInfo ? JSON.stringify(diagram.boundMcuInfo) : ''
          );
        }
      });
      tx();
    },

    remove: (stationId) => {
      const tx = this.db.transaction(() => {
        this.db.prepare('DELETE FROM stations WHERE id = ?').run(stationId);
        this.db.prepare('DELETE FROM diagrams WHERE stationId = ?').run(stationId);
        this.db.prepare('DELETE FROM mcus WHERE stationId = ?').run(stationId);
      });
      tx();
    },

    clearAll: () => {
      const tx = this.db.transaction(() => {
        this.db.prepare('DELETE FROM stations').run();
        this.db.prepare('DELETE FROM diagrams').run();
        this.db.prepare('DELETE FROM mcus').run();
      });
      tx();
    }
  };

  mcu = {
    listByStation: (stationId) =>
      this.db
        .prepare('SELECT id,stationId,sn,ip,port,remark,updateTime FROM mcus WHERE stationId = ?')
        .all(stationId),

    replaceByStation: (stationId, items) => {
      const tx = this.db.transaction(() => {
        this.db.prepare('DELETE FROM mcus WHERE stationId = ?').run(stationId);
        const insertMcu = this.db.prepare(
          'INSERT INTO mcus (id,stationId,sn,ip,port,remark,updateTime) VALUES (?,?,?,?,?,?,?)'
        );
        for (const item of items) {
          insertMcu.run(
            item.id,
            stationId,
            item.sn,
            item.ip ?? '',
            item.port ?? '',
            item.remark ?? '',
            item.updateTime
          );
        }
      });
      tx();
    },

    removeByStation: (stationId) => {
      this.db.prepare('DELETE FROM mcus WHERE stationId = ?').run(stationId);
    }
  };

  template = {
    list: () =>
      this.db
        .prepare(
          'SELECT id,name,remark,content,itemCount,createTime,updateTime FROM templates ORDER BY updateTime DESC'
        )
        .all()
        .map((template) => ({
          ...template,
          content: parseJson(template.content)
        })),

    save: (template) => {
      this.db
        .prepare(
          'INSERT OR REPLACE INTO templates (id,name,remark,content,itemCount,createTime,updateTime) VALUES (?,?,?,?,?,?,?)'
        )
        .run(
          template.id,
          template.name,
          template.remark,
          JSON.stringify(template.content ?? {}),
          template.itemCount,
          template.createTime,
          template.updateTime
        );
    },

    remove: (templateId) => {
      this.db.prepare('DELETE FROM templates WHERE id = ?').run(templateId);
    }
  };

  customSymbol = {
    list: () =>
      this.db
        .prepare(
          `SELECT id,category,title,svg,props,device,attachLabel,createTime,updateTime
           FROM custom_symbols
           ORDER BY category, updateTime, id`
        )
        .all()
        .map((symbol) => ({
          ...symbol,
          props: parseJson(symbol.props, {}),
          device: Boolean(Number(symbol.device)),
          attachLabel: Boolean(Number(symbol.attachLabel))
        })),

    save: (symbol) => {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO custom_symbols
           (id,category,title,svg,props,device,attachLabel,createTime,updateTime)
           VALUES (?,?,?,?,?,?,?,?,?)`
        )
        .run(
          symbol.id,
          symbol.category,
          symbol.title,
          symbol.svg,
          JSON.stringify(symbol.props ?? {}),
          symbol.device ? 1 : 0,
          symbol.attachLabel ? 1 : 0,
          symbol.createTime,
          symbol.updateTime
        );
    },

    remove: (symbolId) => {
      this.db.prepare('DELETE FROM custom_symbols WHERE id = ?').run(symbolId);
    },

    removeByCategory: (category) => {
      this.db.prepare('DELETE FROM custom_symbols WHERE category = ?').run(category);
    }
  };

  point = {
    replaceCategory: (category, rows) => {
      const tx = this.db.transaction(() => {
        this.db.prepare('DELETE FROM points WHERE category = ?').run(category);
        const insertPoint = this.db.prepare(
          'INSERT INTO points (category,device,pointName,innerId,dataType,unit,addrHex,addrDec,offset,source4y,pulseFlag,raw) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        for (const row of rows) {
          insertPoint.run(
            row.category,
            row.device,
            row.pointName,
            row.innerId,
            row.dataType,
            row.unit,
            row.addrHex,
            row.addrDec,
            row.offset,
            row.source4y,
            row.pulseFlag,
            row.raw
          );
        }
      });
      tx();
    },

    list: () =>
      this.db
        .prepare(
          'SELECT id,category,device,pointName,innerId,dataType,unit,addrHex,addrDec,offset,source4y,pulseFlag FROM points ORDER BY category, device, id'
        )
        .all(),

    query: (sql, params = []) => {
      assertSelectQuery(sql);
      return this.db.prepare(sql).all(...params);
    }
  };

  deviceTemplate = {
    replaceFromRows: (rows) => {
      const tx = this.db.transaction(() => {
        this.db.prepare('DELETE FROM device_points').run();
        this.db.prepare('DELETE FROM device_types').run();
        const insertType = this.db.prepare(
          'INSERT OR IGNORE INTO device_types (name, typeCode, createTime, updateTime) VALUES (?,?,?,?)'
        );
        const insertPoint = this.db.prepare(
          'INSERT INTO device_points (deviceType, typeCode, innerId, pointName, displayName, dataType, unit, defaultSelected, sortOrder, selected, raw) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        );
        const now = Date.now();
        const seen = new Set();
        for (const row of rows) {
          if (!row.deviceType) continue;
          if (!seen.has(row.deviceType)) {
            seen.add(row.deviceType);
            insertType.run(row.deviceType, row.typeCode, now, now);
          }
          insertPoint.run(
            row.deviceType,
            row.typeCode,
            row.innerId,
            row.pointName,
            row.displayName,
            row.dataType,
            row.unit,
            row.defaultSelected,
            row.sortOrder,
            row.defaultSelected,
            JSON.stringify(row)
          );
        }
      });
      tx();
    },

    listDeviceTypes: () =>
      this.db
        .prepare(
          `SELECT dt.name AS name, dt.typeCode AS typeCode,
                  COUNT(dp.id) AS pointCount,
                  COALESCE(SUM(dp.selected), 0) AS selectedCount
           FROM device_types dt
           LEFT JOIN device_points dp ON dp.deviceType = dt.name
           GROUP BY dt.name, dt.typeCode
           ORDER BY dt.name`
        )
        .all()
        .map((r) => ({
          name: r.name,
          typeCode: r.typeCode ?? 0,
          pointCount: r.pointCount ?? 0,
          selectedCount: r.selectedCount ?? 0
        })),

    listPointsByDevice: (deviceType) =>
      this.db
        .prepare(
          `SELECT id, deviceType, typeCode, innerId, pointName, displayName,
                  dataType, unit, defaultSelected, sortOrder, selected, raw
           FROM device_points
           WHERE deviceType = ?
           ORDER BY sortOrder, id`
        )
        .all(deviceType),

    saveSelection: (deviceType, selectedIds) => {
      const tx = this.db.transaction(() => {
        this.db.prepare('UPDATE device_points SET selected = 0 WHERE deviceType = ?').run(deviceType);
        const update = this.db.prepare('UPDATE device_points SET selected = 1 WHERE id = ?');
        for (const id of selectedIds) update.run(id);
      });
      tx();
    }
  };

  project = {
    exportBytes: async () => {
      const tmpPath = path.join(
        os.tmpdir(),
        `maotu-project-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
      );
      await this.db.backup(tmpPath);
      const bytes = fs.readFileSync(tmpPath);
      fs.unlinkSync(tmpPath);
      return new Uint8Array(bytes);
    },

    importBytes: (bytes) => {
      const tmpPath = `${this.dbPath}.importing`;
      fs.writeFileSync(tmpPath, Buffer.from(bytes));

      const importedDb = new Database(tmpPath);
      ensureSchema(importedDb);
      importedDb.close();

      this.close();
      removeSidecarFiles(this.dbPath);
      fs.copyFileSync(tmpPath, this.dbPath);
      fs.unlinkSync(tmpPath);
      this.open();
    }
  };
}

function createSqliteService(options) {
  return new SqliteService(options);
}

module.exports = {
  createSqliteService
};
