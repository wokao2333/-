import type {
  DatabaseService,
  DevicePointRow,
  DeviceTypeRow,
  PointInsertRow,
  PointRow
} from './types';
import type {
  McuItem,
  Station,
  StationDiagram
} from '@/components/mt-edit/components/layout/station-aside/types';
import type { TemplateItem } from '@/components/mt-edit/components/layout/template-aside/types';
import { exportFile, getDB, importFile, persist } from '@/db/sqlite';

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  return JSON.parse(value) as T;
}

function assertSelectQuery(sql: string) {
  if (!/^\s*select\b/i.test(sql)) {
    throw new Error('Only SELECT queries are allowed from the renderer');
  }
}

export const webDatabase: DatabaseService = {
  runtime: 'web',
  station: {
    async list() {
      const db = await getDB();
      const stations = db.exec('SELECT id,name,address,remark FROM stations');
      const stationRows = stations.length ? stations[0].values : [];
      const diagrams = db.exec(
        'SELECT id,stationId,name,thumbnail,exportJson,boundDeviceCount,unboundDeviceCount,published,createTime,updateTime,remark,boundMcuId,boundMcuInfo FROM diagrams'
      );
      const diagramRows = diagrams.length ? diagrams[0].values : [];

      const diagramMap = new Map<string, StationDiagram[]>();
      for (const row of diagramRows) {
        const [
          id,
          stationId,
          name,
          thumbnail,
          exportJson,
          boundDeviceCount,
          unboundDeviceCount,
          published,
          createTime,
          updateTime,
          remark,
          boundMcuId,
          boundMcuInfo
        ] = row as unknown[];
        const key = stationId as string;
        const list = diagramMap.get(key) ?? [];
        list.push({
          id: id as string,
          name: name as string,
          remark: (remark as string) || '',
          thumbnail: thumbnail as string,
          exportJson: parseJson<Record<string, unknown>>(exportJson, {}),
          boundDeviceCount: Number(boundDeviceCount) || 0,
          unboundDeviceCount: Number(unboundDeviceCount) || 0,
          published: Boolean(Number(published)),
          createTime: createTime as number,
          updateTime: updateTime as number,
          boundMcuId: (boundMcuId as string) || '',
          boundMcuInfo: parseJson<McuItem | null>(boundMcuInfo, null)
        });
        diagramMap.set(key, list);
      }

      return stationRows.map((row) => {
        const [id, name, address, remark] = row as unknown[];
        return {
          id: id as string,
          name: name as string,
          address: address as string,
          remark: remark as string,
          diagrams: diagramMap.get(id as string) ?? []
        } satisfies Station;
      });
    },
    async save(station) {
      const db = await getDB();
      db.run('BEGIN');
      db.run('INSERT OR REPLACE INTO stations (id,name,address,remark) VALUES (?,?,?,?)', [
        station.id,
        station.name,
        station.address,
        station.remark ?? ''
      ]);
      db.run('DELETE FROM diagrams WHERE stationId = ?', [station.id]);
      const insertDiagram = db.prepare(
        'INSERT INTO diagrams (id,stationId,name,thumbnail,exportJson,boundDeviceCount,unboundDeviceCount,published,createTime,updateTime,remark,boundMcuId,boundMcuInfo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
      );
      for (const diagram of station.diagrams ?? []) {
        insertDiagram.run([
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
        ]);
      }
      insertDiagram.free();
      db.run('COMMIT');
      persist();
    },
    async remove(stationId) {
      const db = await getDB();
      db.run('BEGIN');
      db.run('DELETE FROM stations WHERE id = ?', [stationId]);
      db.run('DELETE FROM diagrams WHERE stationId = ?', [stationId]);
      db.run('DELETE FROM mcus WHERE stationId = ?', [stationId]);
      db.run('COMMIT');
      persist();
    },
    async clearAll() {
      const db = await getDB();
      db.run('BEGIN');
      db.run('DELETE FROM stations');
      db.run('DELETE FROM diagrams');
      db.run('DELETE FROM mcus');
      db.run('COMMIT');
      persist();
    }
  },
  mcu: {
    async listByStation(stationId) {
      const db = await getDB();
      const stmt = db.prepare(
        'SELECT id,stationId,sn,ip,port,remark,updateTime FROM mcus WHERE stationId = ?'
      );
      stmt.bind([stationId]);
      const out: McuItem[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        out.push({
          id: row.id as string,
          stationId: row.stationId as string,
          sn: row.sn as string,
          ip: row.ip as string,
          port: row.port as string,
          remark: row.remark as string,
          updateTime: row.updateTime as number
        });
      }
      stmt.free();
      return out;
    },
    async replaceByStation(stationId, items) {
      const db = await getDB();
      db.run('BEGIN');
      db.run('DELETE FROM mcus WHERE stationId = ?', [stationId]);
      const insertMcu = db.prepare(
        'INSERT INTO mcus (id,stationId,sn,ip,port,remark,updateTime) VALUES (?,?,?,?,?,?,?)'
      );
      for (const item of items) {
        insertMcu.run([
          item.id,
          stationId,
          item.sn,
          item.ip ?? '',
          item.port ?? '',
          item.remark ?? '',
          item.updateTime
        ]);
      }
      insertMcu.free();
      db.run('COMMIT');
      persist();
    },
    async removeByStation(stationId) {
      const db = await getDB();
      db.run('DELETE FROM mcus WHERE stationId = ?', [stationId]);
      persist();
    }
  },
  template: {
    async list() {
      const db = await getDB();
      const stmt = db.prepare(
        'SELECT id,name,remark,content,itemCount,createTime,updateTime FROM templates ORDER BY updateTime DESC'
      );
      const out: TemplateItem[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        out.push({
          id: row.id as string,
          name: row.name as string,
          remark: row.remark as string,
          content: parseJson(row.content, {} as TemplateItem['content']),
          itemCount: row.itemCount as number,
          createTime: row.createTime as number,
          updateTime: row.updateTime as number
        });
      }
      stmt.free();
      return out;
    },
    async save(template) {
      const db = await getDB();
      db.run(
        'INSERT OR REPLACE INTO templates (id,name,remark,content,itemCount,createTime,updateTime) VALUES (?,?,?,?,?,?,?)',
        [
          template.id,
          template.name,
          template.remark,
          JSON.stringify(template.content ?? {}),
          template.itemCount,
          template.createTime,
          template.updateTime
        ]
      );
      persist();
    },
    async remove(templateId) {
      const db = await getDB();
      db.run('DELETE FROM templates WHERE id = ?', [templateId]);
      persist();
    }
  },
  point: {
    async replaceCategory(category, rows: PointInsertRow[]) {
      const db = await getDB();
      db.run('BEGIN');
      db.run('DELETE FROM points WHERE category = ?', [category]);
      const insertPoint = db.prepare(
        'INSERT INTO points (category,device,pointName,innerId,dataType,unit,addrHex,addrDec,offset,source4y,pulseFlag,raw) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
      );
      for (const row of rows) {
        insertPoint.run([
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
        ]);
      }
      insertPoint.free();
      db.run('COMMIT');
      persist();
    },
    async list() {
      const db = await getDB();
      const stmt = db.prepare(
        'SELECT id,category,device,pointName,innerId,dataType,unit,addrHex,addrDec,offset,source4y,pulseFlag FROM points ORDER BY category, device, id'
      );
      const out: PointRow[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as unknown as PointRow);
      stmt.free();
      return out;
    },
    async query(sql, params = []) {
      assertSelectQuery(sql);
      const db = await getDB();
      const stmt = db.prepare(sql);
      if (params.length) stmt.bind(params as never);
      const out: Record<string, unknown>[] = [];
      while (stmt.step()) out.push(stmt.getAsObject());
      stmt.free();
      return out;
    }
  },
  deviceTemplate: {
    async replaceFromRows(rows) {
      const db = await getDB();
      db.run('BEGIN');
      db.run('DELETE FROM device_points');
      db.run('DELETE FROM device_types');
      const insertType = db.prepare(
        'INSERT OR IGNORE INTO device_types (name, typeCode, createTime, updateTime) VALUES (?,?,?,?)'
      );
      const now = Date.now();
      const seen = new Set<string>();
      const insertPoint = db.prepare(
        'INSERT INTO device_points (deviceType, typeCode, innerId, pointName, displayName, dataType, unit, defaultSelected, sortOrder, selected, raw) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
      );
      for (const row of rows) {
        if (!row.deviceType) continue;
        if (!seen.has(row.deviceType)) {
          seen.add(row.deviceType);
          insertType.run([row.deviceType, row.typeCode, now, now]);
        }
        insertPoint.run([
          row.deviceType,
          row.typeCode,
          row.innerId,
          row.pointName,
          row.displayName,
          row.dataType,
          row.unit,
          row.defaultSelected,
          row.sortOrder,
          row.defaultSelected, // 导入时默认选中状态沿用 Excel 标记
          JSON.stringify(row)
        ]);
      }
      insertType.free();
      insertPoint.free();
      db.run('COMMIT');
      persist();
    },
    async listDeviceTypes() {
      const db = await getDB();
      const stmt = db.prepare(
        `SELECT dt.name AS name, dt.typeCode AS typeCode,
                COUNT(dp.id) AS pointCount,
                COALESCE(SUM(dp.selected), 0) AS selectedCount
         FROM device_types dt
         LEFT JOIN device_points dp ON dp.deviceType = dt.name
         GROUP BY dt.name, dt.typeCode
         ORDER BY dt.name`
      );
      const out: DeviceTypeRow[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        out.push({
          name: row.name as string,
          typeCode: (row.typeCode as number) ?? 0,
          pointCount: (row.pointCount as number) ?? 0,
          selectedCount: (row.selectedCount as number) ?? 0
        });
      }
      stmt.free();
      return out;
    },
    async listPointsByDevice(deviceType) {
      const db = await getDB();
      const stmt = db.prepare(
        `SELECT id, deviceType, typeCode, innerId, pointName, displayName,
                dataType, unit, defaultSelected, sortOrder, selected, raw
         FROM device_points
         WHERE deviceType = ?
         ORDER BY sortOrder, id`
      );
      stmt.bind([deviceType]);
      const out: DevicePointRow[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        out.push({
          id: row.id as number,
          deviceType: row.deviceType as string,
          typeCode: (row.typeCode as number) ?? 0,
          innerId: (row.innerId as string) ?? '',
          pointName: (row.pointName as string) ?? '',
          displayName: (row.displayName as string) ?? '',
          dataType: (row.dataType as string) ?? '',
          unit: (row.unit as string) ?? '',
          defaultSelected: (row.defaultSelected as number) ?? 0,
          sortOrder: (row.sortOrder as number) ?? 0,
          selected: (row.selected as number) ?? 0,
          raw: (row.raw as string) ?? ''
        });
      }
      stmt.free();
      return out;
    },
    async saveSelection(deviceType, selectedIds) {
      const db = await getDB();
      db.run('BEGIN');
      db.run('UPDATE device_points SET selected = 0 WHERE deviceType = ?', [deviceType]);
      const update = db.prepare('UPDATE device_points SET selected = 1 WHERE id = ?');
      for (const id of selectedIds) update.run([id]);
      update.free();
      db.run('COMMIT');
      persist();
    }
  },
  project: {
    exportFile,
    importFile
  }
};
