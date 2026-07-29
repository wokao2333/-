import type {
  McuItem,
  Station
} from '@/components/mt-edit/components/layout/station-aside/types';
import db from '@/database';

/**
 * 场站数据去重校验模块。
 *
 * 严格实现三项去重约束，所有校验数据均来自本地数据库
 * （src/database 按运行环境自动选择 Web sql.js 或 Electron SQLite，
 * 因此本模块在两种环境下行为一致、完全兼容 Electron 运行）：
 *
 * 规则 1（全局校验）：禁止出现同名场站 —— validateStationNameUnique
 * 规则 2（场站内部校验）：同一场站下禁止 SN 或 IP 地址相同的 MCU —— validateStationMcus
 * 规则 3（图纸校验）：同一场站下禁止同名一次图 —— validateDiagramNameUnique
 *
 * 校验失败时返回明确的错误提示，包含具体的重复字段与重复值。
 */

/** 触发重复的规则标识 */
export type DedupRule = 'station-name' | 'mcu-sn' | 'mcu-ip' | 'diagram-name';

/** 单条重复校验错误：明确指出重复字段、重复值及出现次数 */
export interface DedupError {
  /** 触发重复的规则 */
  rule: DedupRule;
  /** 重复字段的展示名（场站名称 / SN / IP地址 / 一次图名称） */
  field: string;
  /** 重复的具体值 */
  value: string;
  /** 该值重复出现的次数 */
  count: number;
  /** 面向用户的完整错误提示 */
  message: string;
}

/** 去重校验结果 */
export interface DedupResult {
  /** true 表示无重复，可继续保存 */
  ok: boolean;
  /** 全部重复错误明细（ok 为 true 时为空数组） */
  errors: DedupError[];
  /** 全部错误以「；」拼接的摘要，可直接用于 ElMessage 提示 */
  summary: string;
}

const buildResult = (errors: DedupError[]): DedupResult => ({
  ok: errors.length === 0,
  errors,
  summary: errors.map((e) => e.message).join('；')
});

/** 名称规范化：去除首尾空白后比较，避免「站A」与「站A 」绕过查重 */
const normalizeName = (name: string | null | undefined): string => (name ?? '').trim();

/**
 * 统计字符串数组中的重复项（忽略规范化后为空的值），
 * 返回 value -> 出现次数 的映射（仅保留次数 > 1 的项）。
 */
const collectDuplicates = (values: Array<string | null | undefined>): Map<string, number> => {
  const counter = new Map<string, number>();
  for (const raw of values) {
    const value = normalizeName(raw);
    if (!value) continue;
    counter.set(value, (counter.get(value) ?? 0) + 1);
  }
  const duplicated = new Map<string, number>();
  for (const [value, count] of counter) {
    if (count > 1) duplicated.set(value, count);
  }
  return duplicated;
};

/**
 * 规则 1：全局校验——禁止同名场站。
 *
 * 从本地数据库加载全部场站，检查是否存在与 name 同名（规范化后）的场站；
 * 编辑场站时通过 excludeStationId 排除自身，仅拦截“与其他场站同名”的情况。
 *
 * @param name 待保存的场站名称
 * @param excludeStationId 编辑模式下的当前场站 ID（新增时不传）
 */
export async function validateStationNameUnique(
  name: string,
  excludeStationId?: string
): Promise<DedupResult> {
  const target = normalizeName(name);
  if (!target) return buildResult([]);
  const stations = await db.station.list();
  const conflicts = stations.filter(
    (s) => s.id !== excludeStationId && normalizeName(s.name) === target
  );
  if (!conflicts.length) return buildResult([]);
  return buildResult([
    {
      rule: 'station-name',
      field: '场站名称',
      value: target,
      count: conflicts.length + 1,
      message: `场站名称重复：已存在名为「${target}」的场站，请更换名称`
    }
  ]);
}

/**
 * 规则 3：图纸校验——同一场站下禁止同名一次图。
 *
 * 从本地数据库加载场站及其一次图列表，检查目标场站内是否存在同名一次图；
 * 编辑一次图时通过 excludeDiagramId 排除自身。
 * 名称为空（历史数据回退显示 id）时不参与查重，直接通过。
 *
 * @param stationId 目标场站 ID
 * @param name 待保存的一次图名称
 * @param excludeDiagramId 编辑模式下的当前一次图 ID（新增时不传）
 */
export async function validateDiagramNameUnique(
  stationId: string,
  name: string,
  excludeDiagramId?: string
): Promise<DedupResult> {
  const target = normalizeName(name);
  if (!target) return buildResult([]);
  const stations = await db.station.list();
  const station = stations.find((s) => s.id === stationId);
  if (!station) return buildResult([]);
  const conflicts = station.diagrams.filter(
    (d) => d.id !== excludeDiagramId && normalizeName(d.name) === target
  );
  if (!conflicts.length) return buildResult([]);
  return buildResult([
    {
      rule: 'diagram-name',
      field: '一次图名称',
      value: target,
      count: conflicts.length + 1,
      message: `一次图名称重复：场站「${station.name || stationId}」下已存在同名一次图「${target}」（重复字段：一次图名称，重复值：${target}），请更换名称`
    }
  ]);
}

/**
 * 规则 2：场站内部校验——同一场站下禁止 SN 或 IP 地址相同的 MCU。
 *
 * MCU 的持久化方式为 db.mcu.replaceByStation（整场站覆盖式替换），
 * 因此保存后的最终数据即待保存列表本身，直接对该列表查重即可
 * 完整覆盖“同一场站下 SN / IP 唯一”的约束。
 * persistMode 为 'merge' 时（增量合并场景），会额外加载数据库中
 * 未被待保存列表覆盖（按 id 判断）的现存记录一并查重，防止与库中
 * 已有 MCU 冲突。
 *
 * SN 按规范化（去空白）后精确比较；IP 由调用方在保存前完成 IPv4 合法性
 * 校验与标准化（去除前导零），此处直接比较标准化结果，空值不参与查重。
 *
 * @param stationId 目标场站 ID
 * @param pendingMcus 待保存的 MCU 列表（SN / IP 需已 trim / 标准化）
 * @param options.persistMode 'replace'（默认，整场站覆盖）或 'merge'（增量合并）
 */
export async function validateStationMcus(
  stationId: string,
  pendingMcus: McuItem[],
  options?: { persistMode?: 'replace' | 'merge' }
): Promise<DedupResult> {
  let effective: McuItem[] = pendingMcus;
  if (options?.persistMode === 'merge') {
    const pendingIds = new Set(pendingMcus.map((m) => m.id));
    const existing = await db.mcu.listByStation(stationId);
    effective = [...pendingMcus, ...existing.filter((m) => !pendingIds.has(m.id))];
  }

  const errors: DedupError[] = [];

  for (const [value, count] of collectDuplicates(effective.map((m) => m.sn))) {
    errors.push({
      rule: 'mcu-sn',
      field: 'SN',
      value,
      count,
      message: `MCU 的 SN 重复：「${value}」在同一场站下出现 ${count} 次，同一场站下不允许 SN 相同的 MCU`
    });
  }

  for (const [value, count] of collectDuplicates(effective.map((m) => m.ip))) {
    errors.push({
      rule: 'mcu-ip',
      field: 'IP地址',
      value,
      count,
      message: `MCU 的 IP 地址重复：「${value}」在同一场站下出现 ${count} 次，同一场站下不允许 IP 相同的 MCU`
    });
  }

  return buildResult(errors);
}

/**
 * 导入场站工程包专用校验：对单个待导入场站执行规则 1 与规则 3。
 *
 * - 场站名称与库中“其他场站”（排除同 id，同 id 视为覆盖更新）查重；
 * - 场站自身 diagrams 列表内部的一次图名称查重。
 * 顺序执行 await 调用时数据库已反映此前已导入的场站，
 * 因此同一文件内的同名场站也会被后续校验拦截。
 */
export async function validateStationImport(station: Station): Promise<DedupResult> {
  const errors: DedupError[] = [];

  const nameResult = await validateStationNameUnique(station.name, station.id);
  errors.push(...nameResult.errors);

  const stationLabel = normalizeName(station.name) || station.id;
  for (const [value, count] of collectDuplicates(station.diagrams.map((d) => d.name))) {
    errors.push({
      rule: 'diagram-name',
      field: '一次图名称',
      value,
      count,
      message: `一次图名称重复：场站「${stationLabel}」的数据包内存在 ${count} 个同名一次图「${value}」（重复字段：一次图名称，重复值：${value}）`
    });
  }

  return buildResult(errors);
}
