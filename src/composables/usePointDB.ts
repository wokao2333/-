import db, { type PointInsertRow, type PointRow } from '@/database';
import * as XLSX from 'xlsx';

export type { PointRow };

// 南北向点表（IEC104 四遥）通过统一 database service 持久化。
// 支持从 Excel 导入，以及按关键字/类型灵活查询。
export function usePointDB() {
  const categoryOf = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('遥信')) return 'YX';
    if (n.includes('遥测')) return 'YC';
    if (n.includes('遥控')) return 'YK';
    if (n.includes('遥调')) return 'YT';
    return name;
  };

  const importFromXlsx = async (file: File): Promise<number> => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    let count = 0;

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        defval: '',
        blankrows: false
      }) as unknown[][];

      // 找到真正的表头行（含“点名”与“属性标识”标签）
      const headerIdx = aoa.findIndex(
        (row) =>
          row.includes('点名') && (row.includes('属性标识/内部点ID') || row.includes('内部点ID'))
      );
      if (headerIdx < 0) continue;

      const headers = aoa[headerIdx].map((c) => String(c).trim());
      const col = (name: string) => headers.indexOf(name);
      const category = categoryOf(sheetName);
      const rows: PointInsertRow[] = [];

      for (let i = headerIdx + 1; i < aoa.length; i++) {
        const row = aoa[i];
        const get = (name: string): string => {
          const idx = col(name);
          return idx >= 0 ? String(row[idx] ?? '').trim() : '';
        };
        const pointName = get('点名');
        if (!pointName) continue; // 跳过空行 / 基地址备注行
        const addrDecRaw = get('104地址(十进制)');
        const offsetRaw = get('偏移');
        rows.push({
          category,
          device: get('设备/工作表'),
          pointName,
          innerId: get('属性标识/内部点ID') || get('内部点ID'),
          dataType: get('数据类型'),
          unit: get('单位'),
          addrHex: get('104地址(H)'),
          addrDec: addrDecRaw ? Number(addrDecRaw) : null,
          offset: offsetRaw ? Number(offsetRaw) : null,
          source4y: get('源四遥'),
          pulseFlag: get('遥脉标记'),
          raw: JSON.stringify(row)
        });
      }

      await db.point.replaceCategory(category, rows);
      count += rows.length;
    }

    return count;
  };

  const loadAll = (): Promise<PointRow[]> => db.point.list();

  const query = async (sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
    return db.point.query(sql, params);
  };

  return { importFromXlsx, loadAll, query };
}
