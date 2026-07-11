import db from '@/database';
import type { DevicePointImportRow, DevicePointRow, DeviceTypeRow } from '@/database';
import * as XLSX from 'xlsx';

// 「设备类型-点」Excel 表头顺序：
// 类型 / 类型名称 / 属性标识 / 点名称 / 展示名称 / 数值类型 / 单位 / 是否默认选中 / 排序
function parseRows(aoa: unknown[][]): DevicePointImportRow[] {
  const headerIdx = aoa.findIndex((r) => r.includes('类型名称') && r.includes('属性标识'));
  if (headerIdx < 0) return [];
  const headers = aoa[headerIdx].map((c) => String(c).trim());
  const col = (name: string) => headers.indexOf(name);
  const get = (row: unknown[], name: string): string => {
    const idx = col(name);
    return idx >= 0 ? String(row[idx] ?? '').trim() : '';
  };
  const rows: DevicePointImportRow[] = [];
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

/** 浏览器端解析 Excel File 为测点导入行 */
export async function parseDeviceXlsxFile(file: File): Promise<DevicePointImportRow[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false
  }) as unknown[][];
  return parseRows(aoa);
}

/** 是否运行在 Electron 桌面端（具备按绝对路径导入能力） */
export function hasElectronDeviceImport(): boolean {
  return Boolean(
    (
      window as unknown as {
        api?: { database?: { deviceTemplate?: { importFromPath?: unknown } } };
      }
    ).api?.database?.deviceTemplate?.importFromPath
  );
}

export function useDeviceTemplateDB() {
  const listDeviceTypes = (): Promise<DeviceTypeRow[]> => db.deviceTemplate.listDeviceTypes();
  const listPointsByDevice = (deviceType: string): Promise<DevicePointRow[]> =>
    db.deviceTemplate.listPointsByDevice(deviceType);
  const saveSelection = (deviceType: string, selectedIds: number[]): Promise<void> =>
    db.deviceTemplate.saveSelection(deviceType, selectedIds);
  const replaceFromRows = (rows: DevicePointImportRow[]): Promise<void> =>
    db.deviceTemplate.replaceFromRows(rows);

  /** 选择本地 Excel 文件并导入 */
  const importFromXlsxFile = async (file: File): Promise<number> => {
    const rows = await parseDeviceXlsxFile(file);
    await replaceFromRows(rows);
    return rows.length;
  };

  /** Electron 端：直接解析指定绝对路径的 Excel 并导入 */
  const importFromPath = async (absPath: string): Promise<number> => {
    const bridge = (
      window as unknown as {
        api?: {
          database?: {
            deviceTemplate?: { importFromPath?: (p: string) => Promise<{ count: number }> };
          };
        };
      }
    ).api?.database?.deviceTemplate;
    if (!bridge?.importFromPath) throw new Error('当前环境不支持按路径导入');
    const res = await bridge.importFromPath(absPath);
    return res.count;
  };

  return {
    listDeviceTypes,
    listPointsByDevice,
    saveSelection,
    replaceFromRows,
    importFromXlsxFile,
    importFromPath
  };
}
