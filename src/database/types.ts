import type { McuItem, Station } from '@/components/mt-edit/components/layout/station-aside/types';
import type { TemplateItem } from '@/components/mt-edit/components/layout/template-aside/types';
import type { ILeftAsideConfigItemPublicProps } from '@/components/mt-edit/store/types';

export interface PointRow {
  id: number;
  category: string;
  device: string;
  pointName: string;
  innerId: string;
  dataType: string;
  unit: string;
  addrHex: string;
  addrDec: number | null;
  offset: number | null;
  source4y: string;
  pulseFlag: string;
}

export type PointInsertRow = Omit<PointRow, 'id'> & {
  raw: string;
};

export interface StationRepository {
  list(): Promise<Station[]>;
  save(station: Station): Promise<void>;
  remove(stationId: string): Promise<void>;
  clearAll(): Promise<void>;
}

export interface McuRepository {
  listByStation(stationId: string): Promise<McuItem[]>;
  replaceByStation(stationId: string, items: McuItem[]): Promise<void>;
  removeByStation(stationId: string): Promise<void>;
}

export interface TemplateRepository {
  list(): Promise<TemplateItem[]>;
  save(template: TemplateItem): Promise<void>;
  remove(templateId: string): Promise<void>;
}

/** 用户上传的 SVG 图元原始数据。symbol 在渲染端按 svg 重新生成，避免把 DOM 对象写入数据库。 */
export interface CustomSymbolRow {
  id: string;
  category: string;
  title: string;
  svg: string;
  props: ILeftAsideConfigItemPublicProps;
  device: boolean;
  attachLabel: boolean;
  createTime: number;
  updateTime: number;
}

export interface CustomSymbolRepository {
  list(): Promise<CustomSymbolRow[]>;
  save(symbol: CustomSymbolRow): Promise<void>;
  remove(symbolId: string): Promise<void>;
  removeByCategory(category: string): Promise<void>;
}

export interface PointRepository {
  replaceCategory(category: string, rows: PointInsertRow[]): Promise<void>;
  list(): Promise<PointRow[]>;
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

/** 设备类型：由“设备类型-点”Excel 的「类型名称 / 类型」解析而来 */
export interface DeviceTypeRow {
  /** 设备类型名称（如「并网点上侧」），唯一键 */
  name: string;
  /** 类型标识（Excel「类型」列原文，如 24 或 EV_CHARGER_RESOURCE_MODEL） */
  typeCode: string;
  /** 该类型下测点总数 */
  pointCount: number;
  /** 已配置为展示的测点数量 */
  selectedCount: number;
}

/** 设备类型下的单个测点（一条 Excel 行） */
export interface DevicePointRow {
  id: number;
  /** 所属设备类型名称 */
  deviceType: string;
  /** 类型标识（Excel「类型」列原文） */
  typeCode: string;
  /** 属性标识（内部点 ID，如 PhV_phsA） */
  innerId: string;
  /** 点名称（如「A 相电压」） */
  pointName: string;
  /** 展示名称（如「Ua」） */
  displayName: string;
  /** 数值类型（如 Float） */
  dataType: string;
  /** 单位（如 V / A / kW） */
  unit: string;
  /** Excel 中“是否默认选中”标记：1 选中 0 未选 */
  defaultSelected: number;
  /** 排序序号（Excel「排序」列） */
  sortOrder: number;
  /** 用户当前配置是否展示：1 展示 0 不展示 */
  selected: number;
  /** 原始行 JSON，便于回溯 */
  raw: string;
}

/** 从 Excel 解析出的一条测点（尚未入库，无 id） */
export interface DevicePointImportRow {
  /** 类型标识（Excel「类型」列原文，不转换） */
  typeCode: string;
  deviceType: string;
  innerId: string;
  pointName: string;
  displayName: string;
  dataType: string;
  unit: string;
  defaultSelected: number;
  sortOrder: number;
}

export interface DeviceTemplateRepository {
  /** 用解析后的测点数据整体替换设备类型与测点表（导入 Excel 时调用） */
  replaceFromRows(rows: DevicePointImportRow[]): Promise<void>;
  /** 列出全部设备类型及其测点统计 */
  listDeviceTypes(): Promise<DeviceTypeRow[]>;
  /** 列出指定设备类型下的全部测点（含 selected 标记） */
  listPointsByDevice(deviceType: string): Promise<DevicePointRow[]>;
  /** 保存某设备类型下需要展示的测点 id 集合 */
  saveSelection(deviceType: string, selectedIds: number[]): Promise<void>;
}

export interface ProjectRepository {
  exportFile(): Promise<Blob>;
  importFile(file: File): Promise<void>;
}

export interface DatabaseService {
  readonly runtime: 'web' | 'electron';
  station: StationRepository;
  mcu: McuRepository;
  template: TemplateRepository;
  customSymbol: CustomSymbolRepository;
  point: PointRepository;
  deviceTemplate: DeviceTemplateRepository;
  project: ProjectRepository;
}

export interface ElectronDatabaseBridge {
  station: StationRepository;
  mcu: McuRepository;
  template: TemplateRepository;
  customSymbol: CustomSymbolRepository;
  point: PointRepository;
  deviceTemplate: DeviceTemplateRepository;
  project: {
    exportBytes(): Promise<Uint8Array>;
    importBytes(bytes: Uint8Array): Promise<void>;
  };
}
