<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import type { IExportJson } from '@/components/mt-edit/components/types';
import type { IDoneJson, ILeftAsideConfigItem } from '@/components/mt-edit/store/types';
import { useGenThumbnail, useGenSvgThumbnail } from '@/components/mt-edit/composables/thumbnail';
import { MtEdit, leftAsideStore } from '@/export';
import { useRouter } from 'vue-router';
import { createDefaultCanvasCfg, globalStore } from '@/components/mt-edit/store/global';
import { cacheStore } from '@/components/mt-edit/store/cache';
import { genCanvasDataUrl } from '@/components/mt-edit/composables/canvas-thumbnail';
import { genExportJson, useExportJsonToDoneJson } from '@/components/mt-edit/composables';
import { buildPublishExportJson } from '@/components/mt-edit/composables/publish-assets';
import { randomString, objectDeepClone } from '@/components/mt-edit/utils';
import { createResizeBaseSize } from '@/components/mt-dzr/resize-constraints';
import StationAside from '@/components/mt-edit/components/layout/station-aside/index.vue';
import PreviewDialog from '@/components/mt-preview/preview-dialog.vue';
import type {
  Station,
  StationDiagram,
  AddDiagramPayload,
  McuItem
} from '@/components/mt-edit/components/layout/station-aside/types';
import { useStationDB } from '@/composables/useStationDB';
import { useMcuDB } from '@/composables/useMcuDB';
import { validateDiagramNameUnique, validateStationImport } from '@/composables/useStationDedup';
import { configStore } from '@/components/mt-edit/store/config';
import { useDeviceTemplateDB } from '@/composables/useDeviceTemplateDB';
import { useDeviceTypes } from '@/composables/useDeviceTypes';
import type { DevicePointRow } from '@/database';
import type { DeviceTemplateSelectionChange } from '@/components/mt-edit/components/layout/device-template/types';
import {
  ElAlert,
  ElButton,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElText
} from 'element-plus';

import {
  attachDeviceApiConfig,
  canBindDeviceValue,
  collectDeviceBindingStats,
  ensureDeviceBind,
  getDeviceNameTargetOptions,
  getDeviceTargetOptions,
  getDeviceUnitTargetAttr,
  getDeviceValueColorTargetAttr,
  getPhaseValueColor,
  kvUnitTargetAttr,
  loadDeviceApiConfig,
  normalizeDeviceApiConfig,
  saveDeviceApiConfig,
  setValueByPath,
  syncDeviceFieldMeta,
  type DeviceApiConfig,
  type DeviceBindableItem,
  type DeviceBindInfo,
  type DeviceBindingExportJson,
  type DeviceField,
  type DeviceListItem
} from '@/composables/useDeviceBinding';

const router = useRouter();
const mtEditRef = ref<InstanceType<typeof MtEdit>>();
const deviceFieldsMap = ref<Record<string, DeviceField[]>>({});
const apiConfig = reactive<DeviceApiConfig>(loadDeviceApiConfig());
// 设备列表（来自 EMS /business/microgrid/device/detail?deviceType=...），按当前选中的设备类型加载
const deviceList = ref<DeviceListItem[]>([]);
const deviceListLoading = ref(false);
const deviceListError = ref('');
const deviceListFetched = ref(false);
const deviceListType = ref('');
// 设备列表弹窗相关状态：以表格形式列出当前设备类型下的真实设备，选中一行后绑定到当前图元
const deviceListDialogVisible = ref(false);
const deviceListDialogItem = ref<DeviceBindableItem | null>(null);
const deviceListSelectedId = ref('');
const connectionStatus = shallowRef<'checking' | 'connected' | 'disconnected'>('disconnected');
const deviceListTableRef = ref<InstanceType<typeof ElTable> | null>(null);
// 设备列表弹窗分页状态
const deviceListPage = ref(1);
const deviceListPageSize = ref(10);
// 当前页展示的设备（对完整列表做切片，配合 el-pagination 使用）
const pagedDeviceList = computed<DeviceListItem[]>(() => {
  const start = (deviceListPage.value - 1) * deviceListPageSize.value;
  return deviceList.value.slice(start, start + deviceListPageSize.value);
});

const stations = ref<Station[]>([]);
// 当前画布最近一次成功加载/保存后的快照，用于切换一次图前判断是否有未保存修改。
const savedCanvasSnapshot = ref('');
const drawingDiagram = ref<{
  stationId: string;
  diagramId: string;
  name?: string;
  remark?: string;
} | null>(null);
const currentStationId = ref<string>('');
const stationDB = useStationDB();
const mcuDB = useMcuDB();
// 场站与 MCU 的关联缓存：按场站 ID 缓存其绑定的 MCU 列表。
// 场站本身不再持有连接信息（SN / IP / 端口），所有需要连接信息的场景
// 都通过“场站 → 其绑定的首个 MCU”解析，从而在数据模型上实现场站与MCU的解耦与隔离。
const stationMcus = reactive<Record<string, McuItem[]>>({});

const replaceStationMcus = (stationId: string, list: McuItem[]): McuItem[] => {
  const nextList = list.map((mcu) => ({ ...mcu }));
  stationMcus[stationId] = nextList;
  return nextList;
};

const refreshStationMcus = async (stationId: string): Promise<McuItem[]> => {
  const list = await mcuDB.loadByStation(stationId);
  return replaceStationMcus(stationId, list);
};

const ensureStationMcus = async (stationId: string): Promise<McuItem[]> => {
  if (Object.prototype.hasOwnProperty.call(stationMcus, stationId)) {
    return stationMcus[stationId];
  }
  return refreshStationMcus(stationId);
};

// 场站可能绑定多个独立 MCU；默认以首个 MCU 作为连接目标（常见场景下单场站即单MCU）。
const getStationPrimaryMcu = (stationId: string): McuItem | null =>
  stationMcus[stationId]?.[0] ?? null;

// 一次图已明确绑定 MCU 时优先使用其 boundMcuId；数据库中暂时找不到对应记录时，
// 兼容使用绑定时保存的快照。未绑定具体 MCU 的历史数据才回退到场站首个 MCU。
const getDiagramConnectionMcu = (
  stationId: string,
  diagram: StationDiagram | null
): McuItem | null => {
  const list = stationMcus[stationId] ?? [];
  if (diagram?.boundMcuId) {
    const boundMcu = list.find((mcu) => mcu.id === diagram.boundMcuId);
    if (boundMcu) return boundMcu;
    if (diagram.boundMcuInfo?.id === diagram.boundMcuId) return diagram.boundMcuInfo;
    return null;
  }
  return diagram?.boundMcuInfo ?? list[0] ?? null;
};
// 同步“当前是否已存在场站”到全局状态，供绘制一次接线图的前置校验使用。
// 未添加任何场站时 hasStation 为 false，画布绘图操作将被拦截并提示“请先添加场站”。
// 监听场站数量（而非整个数组引用）：
// 1. stations.value.push/splice 等数组原地变更不会触发对数组的浅监听，
//    但会改变 .length，改用 length getter 可覆盖“添加/删除/导入场站”等所有场景；
// 2. 重新赋值（stations.value = data）同样会改变 length，亦可触发。
watch(
  () => stations.value.length,
  (len) => {
    globalStore.setHasStation(len > 0);
  },
  { immediate: true }
);
// 设备类型（与设备模板库一致的本地数据），用作绑定面板“设备”下拉框数据源。
// 使用跨组件共享的单例响应式状态：导入 Excel 后刷新一次，绑定下拉即可同步更新。
const deviceTemplateDB = useDeviceTemplateDB();
const { deviceTypes, loadDeviceTypes } = useDeviceTypes();

// 当前选中的场站/一次图上下文持久化键。
// 由于 currentStationId / drawingDiagram 仅为组件内内存状态，组件被失活/重挂载
// （如长时间无操作后 Electron 渲染进程重载、路由重渲染、标签页恢复）时会丢失，
// 导致 fetchDeviceList 误判“请先进入场站”。此处将其安全持久化到 localStorage，
// 仅在彻底退出/删除场站时显式清除，从而保证长时间无操作后仍能正常获取设备列表。
const CURRENT_CONTEXT_STORAGE_KEY = 'maotu-current-context';

const persistCurrentContext = () => {
  const ctx = drawingDiagram.value;
  if (!ctx?.stationId) return;
  try {
    localStorage.setItem(
      CURRENT_CONTEXT_STORAGE_KEY,
      JSON.stringify({
        stationId: ctx.stationId,
        diagramId: ctx.diagramId,
        name: ctx.name,
        remark: ctx.remark
      })
    );
  } catch (e) {
    console.error('持久化当前场站上下文失败', e);
  }
};

const clearPersistedContext = () => {
  try {
    localStorage.removeItem(CURRENT_CONTEXT_STORAGE_KEY);
  } catch (e) {
    console.error('清除当前场站上下文失败', e);
  }
};

// 组件重挂载（如页面刷新、失活恢复）后，从本地存储恢复“进入场站”状态，
// 使设备列表获取不再提示“请先进入场站后再获取设备列表”。
const restoreCurrentContext = () => {
  try {
    const raw = localStorage.getItem(CURRENT_CONTEXT_STORAGE_KEY);
    if (!raw) return;
    const ctx = JSON.parse(raw) as {
      stationId: string;
      diagramId: string;
      name?: string;
      remark?: string;
    };
    if (!ctx?.stationId) return;
    const station = stations.value.find((f) => f.id === ctx.stationId);
    if (!station) {
      // 持久化的场站已不存在，清理无效上下文
      clearPersistedContext();
      return;
    }
    const diagram = station.diagrams.find((f) => f.id === ctx.diagramId);
    if (diagram) {
      // 持久化的一次图仍存在，完整恢复画布与场站上下文
      onLoadDiagram(ctx.stationId, ctx.diagramId);
    } else {
      // 一次图已被删除，仅保留场站上下文（仍可用于获取设备列表）
      currentStationId.value = ctx.stationId;
    }
  } catch (e) {
    console.error('恢复当前场站上下文失败', e);
  }
};

/** 当前正在编辑的一次接线图对象（用于读取最近更新时间） */
const currentDiagram = computed(() => {
  if (!drawingDiagram.value) return null;
  const station = stations.value.find((f) => f.id === drawingDiagram.value!.stationId);
  return station?.diagrams.find((f) => f.id === drawingDiagram.value!.diagramId) ?? null;
});
/** 传递给编辑器底部状态栏：当前接线图的最近更新时间 */
const currentDiagramUpdateTime = computed(() => currentDiagram.value?.updateTime);
/**
 * 传递给编辑器底部状态栏：当前正在编辑的一次接线图所「绑定MCU」的 IP 地址，用于连接状态探测。
 * 严格取自该接线图自身的 boundMcuInfo.ip（即用户通过「绑定MCU」为其绑定的那台 MCU），
 * 而非场站列表/详情中的场站整体连接状态，也非场站下首个 MCU 的 IP。
 * 若当前接线图尚未绑定任何 MCU，则返回空串，底部状态栏据此显示为「未连接」。
 */
const currentStationIp = computed(() => {
  const diagram = currentDiagram.value;
  return diagram?.boundMcuInfo?.ip ?? '';
});
/** 传递给编辑器底部状态栏：当前一次接线图所属场站名称 */
const currentStationName = computed(() => {
  if (!drawingDiagram.value) return '';
  return stations.value.find((f) => f.id === drawingDiagram.value!.stationId)?.name ?? '';
});
/** 传递给编辑器底部状态栏：当前一次接线图名称 */
const currentDiagramName = computed(() => currentDiagram.value?.name ?? '');

const getCurrentCanvasExportJson = (): IExportJson =>
  genExportJson(globalStore.canvasCfg, globalStore.gridCfg, globalStore.done_json).exportJson;

const captureSavedCanvasSnapshot = (exportJson = getCurrentCanvasExportJson()) => {
  savedCanvasSnapshot.value = JSON.stringify(exportJson);
};

const hasUnsavedCanvasChanges = () =>
  !!drawingDiagram.value &&
  !!savedCanvasSnapshot.value &&
  JSON.stringify(getCurrentCanvasExportJson()) !== savedCanvasSnapshot.value;

const confirmCanvasTransition = async (): Promise<boolean> => {
  if (!hasUnsavedCanvasChanges()) return true;

  try {
    await ElMessageBox.confirm('当前画布有未保存的修改，是否保存后再继续？', '未保存的修改', {
      confirmButtonText: '保存',
      cancelButtonText: '不保存',
      distinguishCancelAndClose: true,
      type: 'warning'
    });
    return await onSaveDiagram(getCurrentCanvasExportJson());
  } catch (action) {
    // 点击“不保存”继续操作；关闭弹窗或按 Esc 则留在当前画布。
    return action === 'cancel';
  }
};

onMounted(async () => {
  try {
    const data = await stationDB.loadAll();
    stations.value = data;
  } catch (e) {
    console.error('加载场站数据失败', e);
  }
  // 组件重挂载后，从本地存储恢复“进入场站”状态，避免场站上下文丢失
  restoreCurrentContext();
  // 加载设备模板库到共享状态，绑定面板下拉会自动同步
  await loadDeviceTypes();
});

// 由 MCU 实体构造接口基地址：连接信息（IP / 端口）已下沉到 MCU，不再由场站持有。
const buildMcuBaseUrl = (mcu: McuItem): string | null => {
  if (!mcu.ip) {
    ElMessage.error('该MCU未配置 IP 地址，无法建立连接');
    return null;
  }
  let base = `http://${mcu.ip}`;
  if (mcu.port) {
    base += `:${mcu.port}`;
  }
  return base;
};

const getDeviceBind = (item: DeviceBindableItem) => ensureDeviceBind(item);

const getFieldsByDeviceId = (deviceId: string) => deviceFieldsMap.value[deviceId] || [];

const getFieldsForItem = (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);

  if (!bind.deviceType) {
    return [];
  }

  return getFieldsByDeviceId(bind.deviceType);
};

const syncDeviceBindMetaToItem = (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);
  const unitTargetAttr = getDeviceUnitTargetAttr(item);
  const valueColorTargetAttr = getDeviceValueColorTargetAttr(item);

  if (bind.nameTargetAttr && bind.fieldName) {
    setValueByPath(item, bind.nameTargetAttr, bind.fieldName);
  }

  if (unitTargetAttr) {
    setValueByPath(item, unitTargetAttr, bind.unit || '');
  }

  if (valueColorTargetAttr) {
    setValueByPath(item, valueColorTargetAttr, getPhaseValueColor(bind.fieldName || bind.dataKey));
  }
};

// 只读展示该设备类型下所有被选中的测点（由模板预设 selected 决定），以纯文本形式列出名称与单位
const getSelectedPointLabels = (item: DeviceBindableItem): string[] => {
  const bind = ensureDeviceBind(item);
  if (!bind.deviceType) return [];
  return getFieldsForItem(item).map((f) => (f.unit ? `${f.name} (${f.unit})` : f.name));
};

const openDevicePointConfig = (item: DeviceBindableItem) => {
  const deviceType = ensureDeviceBind(item).deviceType;
  if (!deviceType) {
    ElMessage.warning('请先选择设备类型');
    return;
  }
  mtEditRef.value?.openDevicePointConfig(deviceType);
};

const setDefaultField = (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);
  const fields = getFieldsForItem(item);

  if (!bind.dataKey && fields[0]) {
    bind.dataKey = fields[0].key;
    syncDeviceFieldMeta(bind, fields);
    syncDeviceBindMetaToItem(item);
  }
};

// 将图库配置项克隆为一个画布图元（IDoneJson）
const cloneConfigToDoneJson = (
  cfg: ILeftAsideConfigItem,
  binfo: IDoneJson['binfo'],
  overrides: Partial<IDoneJson> = {}
): IDoneJson => ({
  id: cfg.id + '-' + randomString(),
  title: cfg.title,
  type: cfg.type,
  binfo,
  resize: true,
  rotate: true,
  lock: false,
  active: false,
  hide: false,
  use_proportional_scaling: cfg.id !== 'text-vue',
  props: objectDeepClone(cfg.props),
  tag: cfg.id,
  common_animations: objectDeepClone(cfg.common_animations),
  events: [],
  ...overrides
});

// 测点面板参考 04kv-pv-storage-demo.json 中的 group/card/kv 层级。
// 坐标先按参考 group 还原为像素，再按动态宽高换算回百分比，避免长 label 推动 value/card。
const GROUP_W = 147.6093292236328;
const GROUP_H = 129.28123474121094;
const KV_H_PERCENT = 30.166791087715367;
const CARD_W_PERCENT = 55.55204432625488;
const CARD_H_PERCENT = 30.940298551502938;
const DEFAULT_LABEL_WIDTH = 50;
const LABEL_FONT_SIZE = 18;
const LABEL_FONT_FAMILY = '黑体';
const LABEL_SAFE_GAP = 8;
const LABEL_CARD_GAP = 4;
const KV_INNER_PADDING_X = 10;
const VALUE_COLUMN_LEFT_SHIFT = 18;
const VALUE_FONT_SIZE = 22;
const POINT_VALUE_WIDTH = 72;
const POINT_UNIT_GAP = 12;
// 绿色背景只包住值列，不包含右侧单位列。
const POINT_VALUE_CARD_WIDTH = KV_INNER_PADDING_X * 2 + POINT_VALUE_WIDTH;
const PANEL_GAP = 20; // 面板距设备右侧 20px
const ROW_REL_PERCENT = [
  {
    card: { left: 23.039059410930125, top: 0 },
    kv: { left: 0.19582942454948843, top: 0.7614037054850503 }
  },
  {
    card: { left: 23.26136260850913, top: 34.95283311153929 },
    kv: { left: 0.41810677892952297, top: 35.71426632399241 }
  },
  {
    card: { left: 22.848530426490314, top: 69.05970144849705 },
    kv: { left: 0.005300440109678536, top: 69.82110515398212 }
  }
];
const ROW_STEP_PERCENT = 34.95283311153929; // 行间距，用于第 4 行及以后的外推

const percentToPx = (value: number, base: number) => (value / 100) * base;
const pxToPercent = (value: number, base: number) => (value / base) * 100;
const KV_H_PX = percentToPx(KV_H_PERCENT, GROUP_H);
const CARD_W_PX = percentToPx(CARD_W_PERCENT, GROUP_W);
const CARD_H_PX = percentToPx(CARD_H_PERCENT, GROUP_H);
const ROW_STEP_PX = percentToPx(ROW_STEP_PERCENT, GROUP_H);
let textMeasureCanvas: HTMLCanvasElement | null = null;

type PanelRowRelPx = {
  card: { left: number; top: number };
  kv: { left: number; top: number };
};

const rowRelPercentToPx = (rel: (typeof ROW_REL_PERCENT)[number]): PanelRowRelPx => ({
  card: {
    left: percentToPx(rel.card.left, GROUP_W),
    top: percentToPx(rel.card.top, GROUP_H)
  },
  kv: {
    left: percentToPx(rel.kv.left, GROUP_W),
    top: percentToPx(rel.kv.top, GROUP_H)
  }
});

// 根据行索引返回该行的像素定位（前 3 行来自参考 JSON，第 4 行起按行距外推）
const getRowRelPx = (idx: number): PanelRowRelPx => {
  if (idx < ROW_REL_PERCENT.length) return rowRelPercentToPx(ROW_REL_PERCENT[idx]);
  const base = rowRelPercentToPx(ROW_REL_PERCENT[ROW_REL_PERCENT.length - 1]);
  const step = idx - (ROW_REL_PERCENT.length - 1);
  return {
    card: { left: base.card.left, top: base.card.top + step * ROW_STEP_PX },
    kv: { left: base.kv.left, top: base.kv.top + step * ROW_STEP_PX }
  };
};

const measureTextWidth = (text: string, fontSize: number, fontFamily: string) => {
  if (!text) return 0;
  if (typeof document !== 'undefined') {
    textMeasureCanvas ||= document.createElement('canvas');
    const context = textMeasureCanvas.getContext('2d');
    if (context) {
      context.font = `${fontSize}px ${fontFamily}`;
      return context.measureText(text).width;
    }
  }

  return Array.from(text).reduce(
    (sum, char) => sum + (/[^\x00-\xff]/.test(char) ? fontSize : fontSize * 0.56),
    0
  );
};

const getPointFieldName = (point: DevicePointRow) =>
  point.displayName || point.pointName || point.innerId;

const getPanelLabelTextWidth = (label: string) =>
  Math.ceil(measureTextWidth(label, LABEL_FONT_SIZE, LABEL_FONT_FAMILY)) + LABEL_SAFE_GAP;

const getPanelHeight = (rowCount: number) => {
  const lastRel = getRowRelPx(rowCount - 1);
  return Math.max(lastRel.card.top + CARD_H_PX, lastRel.kv.top + KV_H_PX);
};

// 在设备右侧 20px 处生成「卡片背景 + 各测点键值对」测点面板。
// deviceId 为选中设备的真实唯一标识（来自 EMS 设备列表），deviceType 为设备类型名称。
const buildDevicePointPanel = (
  deviceItem: IDoneJson,
  deviceId: string,
  deviceType: string,
  points: DevicePointRow[]
): IDoneJson[] => {
  const cardCfg = configStore.sysComponent.find((i) => i.id === 'card-vue');
  const kvCfg =
    configStore.sysComponent.find((i) => i.id === 'kv-vue') ||
    configStore.sysPrimitive.find((i) => i.id === 'kv-vue');
  if (!cardCfg || !kvCfg || !points.length) return [];
  const configuredUnitWidth = Number(kvCfg.props.unitWidth?.val);
  const pointUnitWidth = Number.isFinite(configuredUnitWidth) ? configuredUnitWidth : 50;

  const rows = points.map((point, idx) => {
    const fieldName = getPointFieldName(point);
    const rel = getRowRelPx(idx);
    const labelTextWidth = getPanelLabelTextWidth(fieldName);
    const valueLeft =
      rel.kv.left + KV_INNER_PADDING_X + DEFAULT_LABEL_WIDTH - VALUE_COLUMN_LEFT_SHIFT;
    const labelTextRight = rel.card.left - LABEL_CARD_GAP;
    const labelKvLeft = labelTextRight - labelTextWidth - KV_INNER_PADDING_X;
    const labelKvWidth = labelTextWidth + KV_INNER_PADDING_X * 2;
    const valueKvLeft = valueLeft - KV_INNER_PADDING_X;
    const valueKvWidth =
      KV_INNER_PADDING_X * 2 + POINT_VALUE_WIDTH + POINT_UNIT_GAP + pointUnitWidth;
    return {
      point,
      fieldName,
      labelTextWidth,
      labelKvLeft,
      labelKvWidth,
      valueKvLeft,
      valueKvWidth,
      rel
    };
  });
  const minLeft = Math.min(0, ...rows.map((row) => row.labelKvLeft));
  const maxRight = Math.max(
    GROUP_W,
    ...rows.flatMap((row) => [
      row.valueKvLeft + POINT_VALUE_CARD_WIDTH,
      row.valueKvLeft + row.valueKvWidth
    ])
  );
  const panelWidth = Math.max(1, maxRight - minLeft);
  const panelHeight = Math.max(1, getPanelHeight(rows.length));
  const children: IDoneJson[] = [];
  rows.forEach((row) => {
    const {
      point,
      fieldName,
      labelTextWidth,
      labelKvLeft,
      labelKvWidth,
      valueKvLeft,
      valueKvWidth,
      rel
    } = row;
    const cardLeft = valueKvLeft - minLeft;
    const normalizedLabelKvLeft = labelKvLeft - minLeft;
    const normalizedValueKvLeft = valueKvLeft - minLeft;

    // 背景卡片锚定不动；label/value/unit 各自独立定位，互不挤压。
    const card = cloneConfigToDoneJson(cardCfg, {
      left: pxToPercent(cardLeft, panelWidth),
      top: pxToPercent(rel.card.top, panelHeight),
      // 卡片只覆盖 value 列，unit 列保持在绿色框外。
      width: pxToPercent(POINT_VALUE_CARD_WIDTH, panelWidth),
      height: pxToPercent(CARD_H_PX, panelHeight),
      angle: 0
    });
    card.use_proportional_scaling = false;
    card.devicePanelGenerated = true;
    card.deviceBind = { deviceId: '', dataKey: '', targetAttr: '', nameTargetAttr: '', unit: '' };
    children.push(card);

    const labelKv = cloneConfigToDoneJson(kvCfg, {
      left: pxToPercent(normalizedLabelKvLeft, panelWidth),
      top: pxToPercent(rel.kv.top, panelHeight),
      width: pxToPercent(labelKvWidth, panelWidth),
      height: pxToPercent(KV_H_PX, panelHeight),
      angle: 0
    });
    labelKv.props.fontFamily.val = LABEL_FONT_FAMILY;
    labelKv.props.label.val = fieldName;
    labelKv.props.labelWidth.val = labelTextWidth;
    labelKv.props.labelFontSize.val = LABEL_FONT_SIZE;
    labelKv.props.value.val = '';
    labelKv.props.valueWidth.val = 0;
    labelKv.props.unit.val = ' ';
    labelKv.props.unitWidth.val = 0;
    labelKv.props.unitGap.val = 0;
    labelKv.devicePanelGenerated = true;
    labelKv.deviceBind = {
      deviceId: '',
      dataKey: '',
      targetAttr: '',
      nameTargetAttr: '',
      unit: ''
    };
    children.push(labelKv);

    // value/unit 使用独立 kv，labelWidth 固定为 0，保证所有行的值和单位绝对位置一致。
    const kv = cloneConfigToDoneJson(kvCfg, {
      left: pxToPercent(normalizedValueKvLeft, panelWidth),
      top: pxToPercent(rel.kv.top, panelHeight),
      width: pxToPercent(valueKvWidth, panelWidth),
      height: pxToPercent(KV_H_PX, panelHeight),
      angle: 0
    });
    kv.props.fontFamily.val = LABEL_FONT_FAMILY;
    kv.props.label.val = '';
    kv.props.labelWidth.val = 0;
    kv.props.labelFontSize.val = LABEL_FONT_SIZE; // 键名字号
    kv.props.value.val = '键值';
    kv.props.valueWidth.val = POINT_VALUE_WIDTH;
    kv.props.valueFontSize.val = VALUE_FONT_SIZE; // 键值字号（比键名大 8px）
    kv.props.valueColor.val = getPhaseValueColor(fieldName); // 相序颜色：Ua=#FFF700, Ub=#00FF00, Uc=#FF0000
    kv.props.unit.val = point.unit;
    kv.props.unitWidth.val = pointUnitWidth;
    kv.props.unitGap.val = POINT_UNIT_GAP;
    kv.devicePanelGenerated = true;
    kv.deviceBind = {
      deviceId,
      dataKey: point.innerId,
      targetAttr: 'props.value.val',
      nameTargetAttr: '',
      unit: point.unit,
      fieldName,
      deviceType
    };
    children.push(kv);
  });

  const panelLeft = deviceItem.binfo.left + deviceItem.binfo.width + PANEL_GAP;
  const group: IDoneJson = {
    // 基于设备图元 id 生成确定性面板 id，确保重新选择设备/加载旧图时总能定位并移除旧面板
    id: 'device-panel-' + deviceItem.id,
    // 标记该面板归属的设备图元，便于后续重建时精确移除（兼容历史随机 id 面板）
    devicePanelFor: deviceItem.id,
    devicePanelGenerated: true,
    title: '组合',
    type: 'group',
    binfo: {
      left: panelLeft + minLeft,
      top: deviceItem.binfo.top,
      width: panelWidth,
      height: panelHeight,
      angle: 0
    },
    resize_base_size: createResizeBaseSize({
      left: panelLeft + minLeft,
      top: deviceItem.binfo.top,
      width: panelWidth,
      height: panelHeight,
      angle: 0
    }),
    resize: true,
    rotate: true,
    lock: false,
    active: false,
    hide: false,
    use_proportional_scaling: true,
    props: {},
    common_animations: { val: '', delay: 'delay-0s', speed: 'slow', repeat: 'infinite' },
    children,
    events: [],
    tag: 'group',
    deviceBind: { deviceId: '', dataKey: '', targetAttr: '', nameTargetAttr: '', unit: '' }
  };

  return [group];
};

// 判断一个分组是否为“设备测点面板”（由 buildDevicePointPanel 生成，子节点均为绑定了测点的 kv-vue）。
// 用于重新选择设备时，可靠地移除该设备既有的测点面板（包括历史旧面板），避免残留导致重复请求。
const isDevicePointPanelGroup = (g: any): boolean => {
  if (!g || g.type !== 'group' || !Array.isArray(g.children) || g.children.length === 0)
    return false;
  return g.children.every(
    (c: any) =>
      (c.tag === 'kv-vue' || c.type === 'kv-vue') &&
      !!c.deviceBind?.dataKey &&
      c.deviceBind?.targetAttr === 'props.value.val'
  );
};

// 从一次接线图数据中移除历史遗留的“deviceId 被误写为设备类型名”的测点面板分组，
// 避免脏数据流入预览或其他消费方，造成重复/错误的实时数据请求。
const stripLegacyDevicePanels = (exportJson: IExportJson) => {
  const typeNames = new Set(deviceTypes.value.map((dt) => dt.name));
  const strip = (items: any[]): any[] =>
    items.filter((item) => {
      const isLegacy =
        isDevicePointPanelGroup(item) &&
        item.children.every((c: any) => typeNames.has(String(c.deviceBind?.deviceId)));
      if (isLegacy) return false;
      if (Array.isArray(item.children)) {
        item.children = strip(item.children);
      }
      return true;
    });
  exportJson.json = strip(exportJson.json as any[]) as IExportJson['json'];
};

interface DevicePanelSource {
  item: IDoneJson;
  deviceId: string;
  deviceType: string;
}

// 一次性替换一个或多个设备的测点面板；模板批量刷新时只产生一条撤销历史。
const replaceDevicePointPanels = (sources: DevicePanelSource[], points: DevicePointRow[]) => {
  const ownerIds = new Set(sources.map(({ item }) => item.id));
  const panelIds = new Set(sources.map(({ item }) => `device-panel-${item.id}`));
  const targetTypes = new Set(sources.map(({ deviceType }) => deviceType));
  // 历史旧面板（旧逻辑将 kv.deviceBind.deviceId 误写为设备类型名称，如“并网点上侧”）的 group 使用随机 id，
  // 无法被 panelId 命中；此处依据“kv.deviceBind.deviceId 命中已知设备类型名”这一旧 bug 特征将其一并移除，
  // 确保重新选择设备时仅保留一份正确的测点面板。
  const isLegacyPanel = (i: any): boolean =>
    isDevicePointPanelGroup(i) &&
    i.children.every((c: any) => targetTypes.has(String(c.deviceBind?.deviceId)));
  const base = globalStore.done_json.filter(
    (i) =>
      !panelIds.has(i.id) &&
      !(i.devicePanelFor && ownerIds.has(i.devicePanelFor)) &&
      !isLegacyPanel(i)
  );
  const panels = points.length
    ? sources.flatMap(({ item, deviceId, deviceType }) =>
        buildDevicePointPanel(item, deviceId, deviceType, points)
      )
    : [];
  globalStore.setGlobalStoreDoneJson([...base, ...panels]);
  cacheStore.addHistory(globalStore.done_json);
};

// 为选中设备创建/刷新测点面板，先按确定性面板 id 移除该设备已有的面板（兼容从数据库加载的旧图），避免重复/残留旧面板
const buildAndAddDevicePointPanel = (
  deviceItem: IDoneJson,
  deviceId: string,
  deviceType: string,
  points: DevicePointRow[]
) => {
  replaceDevicePointPanels([{ item: deviceItem, deviceId, deviceType }], points);
};

const syncDeviceFields = (deviceType: string, points: DevicePointRow[]) => {
  deviceFieldsMap.value[deviceType] = points.map((point) => ({
    key: point.innerId,
    name: point.pointName,
    displayName: point.displayName,
    unit: point.unit
  }));
};

// 收集已配置指定设备类型的图元。测点面板属于模板配置，即使尚未绑定真实 deviceId 也应同步刷新。
const collectDevicesByType = (deviceType: string): IDoneJson[] => {
  const result: IDoneJson[] = [];
  const visit = (items: IDoneJson[]) => {
    for (const item of items) {
      // 自动生成的测点面板也带 deviceBind，不能把面板内的 kv 当成设备再次重建。
      if (item.devicePanelFor) continue;

      if (item.device === true && item.deviceBind?.deviceType === deviceType) {
        result.push(item);
      }

      if (item.children?.length) visit(item.children);
    }
  };

  visit(globalStore.done_json);
  return result;
};

const onDeviceTemplateChange = ({ deviceType, points }: DeviceTemplateSelectionChange) => {
  syncDeviceFields(deviceType, points);
  const devices = collectDevicesByType(deviceType);
  if (!devices.length) return;

  replaceDevicePointPanels(
    devices.map((device) => ({
      item: device,
      deviceId: device.deviceBind?.deviceId || '',
      deviceType
    })),
    points
  );
};

const getEtypeForType = (typeName?: string): number | string | undefined => {
  if (!typeName) return undefined;
  const row = deviceTypes.value.find((dt) => dt.name === typeName);
  return row?.typeCode;
};

// 依据已选设备类型（deviceType）加载该类型下的测点，并以键值对面板形式展示在设备右侧 20px 处。
// 传入 buildAndAddDevicePointPanel 的 deviceId 为“已绑定的真实设备 deviceId”（拖出绑定后填充）。
const rebuildDevicePanel = async (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);
  const type = bind.deviceType;

  if (!type) {
    bind.dataKey = '';
    bind.fieldName = '';
    bind.unit = '';
    buildAndAddDevicePointPanel(
      item as unknown as IDoneJson,
      bind.deviceId,
      bind.deviceType ?? '',
      []
    );
    return;
  }

  // 1) 查询该设备类型绑定的测点作为“选中项”
  const allPoints = await deviceTemplateDB.listPointsByDevice(type);
  const selectedPoints = allPoints.filter((p) => p.selected === 1);

  // 供“属性”展示与绑定复用测点列表（按设备类型分组）
  syncDeviceFields(type, selectedPoints);

  // 2~4) 以键值对形式循环展示，并定位在设备右侧 20px 处
  buildAndAddDevicePointPanel(
    item as unknown as IDoneJson,
    bind.deviceId,
    bind.deviceType ?? '',
    selectedPoints
  );
};

const onDeviceChange = async (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);

  // 切换设备类型时，清空已绑定的具体设备及其设备列表，避免沿用上一个类型的设备
  bind.deviceId = '';
  bind.deviceTypeName = '';
  bind.dataKey = '';
  bind.fieldName = '';
  bind.unit = '';
  deviceList.value = [];
  deviceListFetched.value = false;
  deviceListError.value = '';
  deviceListType.value = '';

  await rebuildDevicePanel(item);
  setDefaultField(item);
  syncDeviceBindMetaToItem(item);
};

// 点击设备列表中的具体设备后，将其真实 deviceId 绑定到当前一次接线图，
// 并以真实 deviceId 重建测点面板（面板内各测点键值对的 deviceBind.deviceId 即为此真实 deviceId）
const onDeviceSelect = async (item: DeviceBindableItem, dev: DeviceListItem) => {
  const bind = ensureDeviceBind(item);
  bind.deviceId = String(dev.deviceId);
  bind.deviceTypeName = dev.deviceTypeName;
  bind.deviceName = dev.deviceName;
  await rebuildDevicePanel(item);
  syncDeviceBindMetaToItem(item);
};

// 选中设备类型后，点击“设备列表”触发：按该类型对应的 EMS etype 拉取该类型下的真实设备清单
const fetchDeviceList = async (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);
  const typeName = bind.deviceType;
  if (!typeName) {
    ElMessage.warning('请先选择设备类型');
    return;
  }
  if (!currentStationId.value) {
    ElMessage.error('请先进入场站后再获取设备列表');
    return;
  }
  const station = stations.value.find((f) => f.id === currentStationId.value);
  if (!station) return;
  // 每次点击都从数据库刷新，避免进入一次图时缓存的空列表/旧 IP 导致误判。
  // 当前一次图已绑定具体 MCU 时按 boundMcuId 精确选择，避免多 MCU 场站取错首条记录。
  await refreshStationMcus(station.id);
  const mcu = getDiagramConnectionMcu(station.id, currentDiagram.value);
  if (!mcu || !mcu.ip) {
    deviceListError.value = '该场站尚未绑定MCU或未配置IP，无法获取设备列表';
    ElMessage.error(deviceListError.value);
    return;
  }
  const baseUrl = buildMcuBaseUrl(mcu);
  if (!baseUrl) return;

  const etype = getEtypeForType(typeName);
  if (etype === undefined) {
    deviceListError.value = `未找到设备类型「${typeName}」对应的 EMS etype`;
    ElMessage.error(deviceListError.value);
    return;
  }

  deviceListLoading.value = true;
  deviceListError.value = '';
  try {
    const url = `${baseUrl}/business/microgrid/device/detail?deviceType=${encodeURIComponent(
      String(etype)
    )}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json.code !== 200) {
      throw new Error(json.msg || json.message || `code=${json.code}`);
    }
    const rawList = Array.isArray(json.data) ? json.data : [];
    deviceList.value = rawList
      .map((d: Record<string, unknown>) => ({
        deviceType: d.deviceType as number | string,
        deviceTypeName: String(d.deviceTypeName ?? ''),
        deviceId: d.deviceId as string | number,
        deviceName: String(d.deviceName ?? d.deviceId ?? '')
      }))
      .filter((d: DeviceListItem) => d.deviceId !== undefined && d.deviceId !== '');
    deviceListFetched.value = true;
    deviceListType.value = typeName;
    if (!deviceList.value.length) {
      ElMessage.info('该设备类型下暂无设备');
    }
  } catch (error: any) {
    deviceListError.value = `获取设备列表失败: ${error?.message || String(error)}`;
    ElMessage.error(deviceListError.value);
    console.error('fetchDeviceList error', error);
  } finally {
    deviceListLoading.value = false;
  }
};

// 点击「加载设备列表」：先确认当前一次图有可用的 MCU 连接，再打开弹窗。
const openDeviceListDialog = async (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);
  if (!bind.deviceType) {
    ElMessage.warning('请先选择设备类型');
    return;
  }
  if (connectionStatus.value !== 'connected') {
    ElMessage.warning(
      connectionStatus.value === 'checking' ? '连接状态检测中，请稍后再试' : '当前未连接'
    );
    return;
  }
  if (!currentStationId.value) {
    ElMessage.error('请先进入场站后再获取设备列表');
    return;
  }
  const station = stations.value.find((f) => f.id === currentStationId.value);
  if (!station) return;

  await refreshStationMcus(station.id);
  const mcu = getDiagramConnectionMcu(station.id, currentDiagram.value);
  if (!mcu?.ip) {
    deviceListError.value = '该场站尚未绑定MCU或未配置IP，无法获取设备列表';
    ElMessage.error(deviceListError.value);
    return;
  }

  deviceListDialogItem.value = item;
  deviceListDialogVisible.value = true;
};

// 弹窗完全打开后：拉取设备列表，并将当前已绑定的设备行高亮（保证同一时间仅一行被选中）
const onDeviceListDialogOpened = async () => {
  const item = deviceListDialogItem.value;
  if (!item) return;
  deviceListPage.value = 1;
  await fetchDeviceList(item);
  const table = deviceListTableRef.value;
  if (!table) return;
  const current =
    deviceList.value.find((d) => String(d.deviceId) === getDeviceBind(item).deviceId) || null;
  table.setCurrentRow(current);
  deviceListSelectedId.value = getDeviceBind(item).deviceId || '';
};

// 表格严格单选：当前行切换时更新待选择设备，highlight-current-row 保证同一时间只有一行被选中
const onDeviceListCurrentChange = (row: DeviceListItem | null) => {
  deviceListSelectedId.value = row ? String(row.deviceId) : '';
};

// 翻页后：若上一页选中的设备在当前页，重新高亮该行，保持选中态可见
const onDeviceListPageChange = (page: number) => {
  deviceListPage.value = page;
  nextTick(() => {
    const table = deviceListTableRef.value;
    if (!table) return;
    const current =
      pagedDeviceList.value.find((d) => String(d.deviceId) === deviceListSelectedId.value) || null;
    table.setCurrentRow(current);
  });
};

// 调整每页条数：回到第 1 页并重新高亮已选中的设备行
const onDeviceListSizeChange = (size: number) => {
  deviceListPageSize.value = size;
  deviceListPage.value = 1;
  nextTick(() => {
    const table = deviceListTableRef.value;
    if (!table) return;
    const current =
      pagedDeviceList.value.find((d) => String(d.deviceId) === deviceListSelectedId.value) || null;
    table.setCurrentRow(current);
  });
};

// 确认选择：把选中的设备绑定到当前图元，并关闭弹窗
const onConfirmDeviceSelect = () => {
  const item = deviceListDialogItem.value;
  const dev = deviceList.value.find((d) => String(d.deviceId) === deviceListSelectedId.value);
  if (!item || !dev) {
    ElMessage.warning('请选择设备');
    return;
  }
  onDeviceSelect(item, dev);
  deviceListDialogVisible.value = false;
};

const onDeviceFieldChange = (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);
  syncDeviceFieldMeta(bind, getFieldsForItem(item));
  syncDeviceBindMetaToItem(item);
};

const withDeviceSourceConfig = (exportJson: IExportJson) => {
  const normalizedConfig = normalizeDeviceApiConfig(apiConfig);
  saveDeviceApiConfig(normalizedConfig);
  return attachDeviceApiConfig(exportJson, normalizedConfig);
};

const buildPublishContentJson = (exportJson: IExportJson) =>
  JSON.stringify(
    buildPublishExportJson(withDeviceSourceConfig(exportJson), {
      leftAsideConfig: leftAsideStore.config
    })
  );

const exportExtra = computed(() => ({
  deviceApiConfig: normalizeDeviceApiConfig(apiConfig)
}));

const onImportSuccess = (exportJson: DeviceBindingExportJson) => {
  if (!exportJson.deviceApiConfig) {
    return;
  }

  Object.assign(apiConfig, normalizeDeviceApiConfig(exportJson.deviceApiConfig));
  saveDeviceApiConfig(apiConfig);
};

interface BoundPointGroup {
  dataKeys: Set<string>;
  items: any[];
}

/** 从 exportJson 中提取已绑定设备及其测点，按 deviceId 分组（递归包含嵌套的测点键值对） */
const extractBoundPointGroups = (exportJson: IExportJson): Record<string, BoundPointGroup> => {
  const groups: Record<string, BoundPointGroup> = {};
  // 已知设备类型名集合，用于剔除历史遗留的“deviceId 被误写为设备类型名”的脏数据，
  // 避免出现一份正确 + 一份错误类型的重复请求（第二次错误请求会覆盖正确数据）。
  const typeNames = new Set(deviceTypes.value.map((dt) => dt.name));
  const visit = (items: IExportJson['json']) => {
    for (const item of items) {
      const bind = (item as any).deviceBind as DeviceBindInfo | undefined;
      if (bind?.deviceId && bind?.dataKey) {
        // 跳过 deviceId 实为设备类型名的脏数据（旧逻辑遗留），仅保留真实设备 ID 的分组
        if (typeNames.has(String(bind.deviceId))) continue;
        if (!groups[bind.deviceId]) {
          groups[bind.deviceId] = { dataKeys: new Set(), items: [] };
        }
        groups[bind.deviceId].dataKeys.add(bind.dataKey);
        groups[bind.deviceId].items.push(item);
      }
      const children = (item as any).children as IExportJson['json'] | undefined;
      if (children?.length) {
        visit(children);
      }
    }
  };
  visit(exportJson.json);
  return groups;
};

/** 调用批量测点实时接口 */
const fetchBatchPointData = async (
  baseUrl: string,
  deviceId: string,
  pointKeys: string[]
): Promise<Record<string, { value: unknown; unit?: string }>> => {
  const url = `${baseUrl}/business/microgrid/device/current/batchPoint`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, pointKeys })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = await response.json();
  if (json.code !== 200) {
    throw new Error(json.msg || `code=${json.code}`);
  }
  const rawData = json.data as Record<string, { pointCode: string; value: unknown; unit?: string }>;
  const normalized: Record<string, { value: unknown; unit?: string }> = {};
  for (const key in rawData) {
    const point = rawData[key];
    if (point && typeof point === 'object') {
      normalized[key] = { value: point.value, unit: point.unit };
    }
  }
  return normalized;
};

/** 将实时数据写入 exportJson 对应项的 props（递归包含嵌套的测点键值对） */
const injectRealtimeData = (
  exportJson: IExportJson,
  realtimeDataMap: Record<string, Record<string, { value: unknown; unit?: string }>>
) => {
  const visit = (items: IExportJson['json']) => {
    for (const item of items) {
      const bind = (item as any).deviceBind as DeviceBindInfo | undefined;
      if (bind?.deviceId && bind?.dataKey && bind?.targetAttr) {
        const deviceData = realtimeDataMap[bind.deviceId];
        if (deviceData) {
          const pointData = deviceData[bind.dataKey];
          if (pointData && pointData.value !== undefined && pointData.value !== null) {
            // exportJson 中 props 为嵌套结构 { value: { val }, unit: { val } }，
            // targetAttr 形如 props.value.val，必须写入到最深层 val，
            // 若直接覆盖 props.value/props.unit 会破坏 { val } 结构，导致渲染时取不到值。
            setValueByPath(item, bind.targetAttr, pointData.value);
            if (pointData.unit !== undefined && pointData.unit !== null && pointData.unit !== '') {
              setValueByPath(item, kvUnitTargetAttr, pointData.unit);
            }
          }
        }
      }
      const children = (item as any).children as IExportJson['json'] | undefined;
      if (children?.length) {
        visit(children);
      }
    }
  };
  visit(exportJson.json);
};

const onPreviewClick = async (
  exportJson: IExportJson,
  stationId: string | undefined = currentStationId.value
) => {
  const groups = extractBoundPointGroups(exportJson);
  const groupEntries = Object.entries(groups);
  // 预览前清理历史遗留的旧测点面板（deviceId 误写为类型名），确保仅保留正确分组，
  // 既避免 /batchPoint 重复请求，也避免错误返回值覆盖正确数据。
  stripLegacyDevicePanels(exportJson);

  if (groupEntries.length > 0) {
    if (!stationId) {
      ElMessage.warning('未确定当前画布所属场站，无法获取实时数据，将以静态数据预览');
    } else {
      const station = stations.value.find((f) => f.id === stationId);
      // 连接信息已下沉到 MCU：确保该场站的MCU已加载后，从其首个MCU解析接口地址
      await ensureStationMcus(stationId);
      const mcu = station ? getStationPrimaryMcu(station.id) : null;
      const baseUrl = mcu?.ip ? buildMcuBaseUrl(mcu) : null;
      if (!baseUrl) {
        ElMessage.warning('当前场站尚未绑定MCU或未配置IP，无法获取实时数据');
      } else {
        try {
          const realtimeDataMap: Record<
            string,
            Record<string, { value: unknown; unit?: string }>
          > = {};
          for (const [deviceId, group] of groupEntries) {
            const data = await fetchBatchPointData(baseUrl, deviceId, Array.from(group.dataKeys));
            realtimeDataMap[deviceId] = data;
          }
          injectRealtimeData(exportJson, realtimeDataMap);
          ElMessage.success('实时数据已绑定到预览');
        } catch (e: any) {
          console.error('获取实时数据失败', e);
          ElMessage.error(`获取实时数据失败: ${e.message}`);
        }
      }
    }
  }

  previewExportJson.value = withDeviceSourceConfig(exportJson);
  previewVisible.value = true;
};
// 预览弹窗状态：以 Modal 形式在当前页面展示预览，替代原先打开新页面的方式
const previewVisible = ref(false);
const previewExportJson = ref<IExportJson | null>(null);

// 场站详情列表中的“预览”：复用顶部“预览”按钮的完整逻辑，
// 使用该行一次图自身的 exportJson 与其所属场站发起预览。
const onPreviewDiagram = (stationId: string, diagram: StationDiagram) => {
  onPreviewClick(diagram.exportJson as unknown as IExportJson, stationId);
};

const onSaveClick = async (exportJson: IExportJson) => {
  if (drawingDiagram.value) {
    await onSaveDiagram(exportJson);
  } else {
    console.log(withDeviceSourceConfig(exportJson), '这是要保存的数据');
  }
};

const markDiagramPublished = async (stationId: string, diagramId: string) => {
  const stationIndex = stations.value.findIndex((item) => item.id === stationId);
  if (stationIndex < 0) {
    throw new Error('未找到当前场站信息');
  }

  const station = stations.value[stationIndex];
  if (!station.diagrams.some((diagram) => diagram.id === diagramId)) {
    throw new Error('未找到当前一次图记录，请先保存后再发布');
  }

  const updatedStation: Station = {
    ...station,
    diagrams: station.diagrams.map((diagram) => ({
      ...diagram,
      published: diagram.id === diagramId
    }))
  };

  stations.value.splice(stationIndex, 1, updatedStation);
  try {
    await stationDB.save(updatedStation);
  } catch (error) {
    stations.value.splice(stationIndex, 1, station);
    throw error;
  }
};

const onPublishClick = async (exportJson: IExportJson) => {
  if (!currentStationId.value) {
    ElMessage.warning('未确定当前画布所属场站，无法发布');
    return;
  }
  const diagramId = drawingDiagram.value?.diagramId;
  if (!diagramId) {
    ElMessage.warning('请先选择或保存一次接线图后再发布');
    return;
  }
  const station = stations.value.find((f) => f.id === currentStationId.value);
  if (!station) {
    ElMessage.error('未找到当前场站信息');
    return;
  }
  // 优先使用当前一次图绑定的 MCU；未绑定具体 MCU 的历史数据才回退到场站首个 MCU。
  await ensureStationMcus(station.id);
  const mcu = getDiagramConnectionMcu(station.id, currentDiagram.value);
  if (!mcu || !mcu.ip) {
    ElMessage.error('当前一次图尚未绑定MCU或MCU未配置IP，无法发布');
    return;
  }

  const baseUrl = buildMcuBaseUrl(mcu);
  if (!baseUrl) return;

  const url = `${baseUrl}/business/lineDiagram/publish`;

  try {
    const requestBody = {
      clientIp: mcu.ip,
      designName: diagramId,
      contentJson: buildPublishContentJson(exportJson),
      remark: station.remark ?? ''
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json.code !== 200) {
      throw new Error(json.msg || `接口返回 code=${json.code}`);
    }
    try {
      await markDiagramPublished(station.id, diagramId);
    } catch (error: any) {
      const msg = error?.message || String(error);
      ElMessage.warning(`发布成功，但本地发布状态保存失败: ${msg}`);
      console.error('保存发布状态失败', error);
      return;
    }
    ElMessage.success('发布成功');
    console.log('发布成功', json);
  } catch (error: any) {
    const msg = error?.message || String(error);
    ElMessage.error(`发布失败: ${msg}`);
    console.error('发布失败', { url, mcuId: mcu.id, mcuIp: mcu.ip, mcuPort: mcu.port }, error);
  }
};

const onPublishDiagram = async (stationId: string, diagramId: string) => {
  const station = stations.value.find((f) => f.id === stationId);
  if (!station) {
    ElMessage.error('未找到当前场站信息');
    return;
  }
  const diagram = station.diagrams.find((d) => d.id === diagramId);
  if (!diagram) {
    ElMessage.error('未找到当前一次接线图');
    return;
  }
  // 优先使用该一次图绑定的 MCU；未绑定具体 MCU 的历史数据才回退到场站首个 MCU。
  await ensureStationMcus(station.id);
  const mcu = getDiagramConnectionMcu(station.id, diagram);
  if (!mcu || !mcu.ip) {
    ElMessage.error('该一次图尚未绑定MCU或MCU未配置IP，无法发布');
    return;
  }

  const baseUrl = buildMcuBaseUrl(mcu);
  if (!baseUrl) return;

  const url = `${baseUrl}/business/lineDiagram/publish`;
  const exportJson = diagram.exportJson as unknown as IExportJson;
  try {
    const requestBody = {
      clientIp: mcu.ip,
      designName: diagramId,
      contentJson: buildPublishContentJson(exportJson),
      remark: station.remark ?? ''
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json.code !== 200) {
      throw new Error(json.msg || `接口返回 code=${json.code}`);
    }
    try {
      await markDiagramPublished(station.id, diagramId);
    } catch (error: any) {
      const msg = error?.message || String(error);
      ElMessage.warning(`发布成功，但本地发布状态保存失败: ${msg}`);
      console.error('保存发布状态失败', error);
      return;
    }
    ElMessage.success('发布成功');
    console.log('发布成功', json);
  } catch (error: any) {
    const msg = error?.message || String(error);
    ElMessage.error(`发布失败: ${msg}`);
    console.error('发布失败', { url, mcuId: mcu.id, mcuIp: mcu.ip, mcuPort: mcu.port }, error);
  }
};

const onReturnClick = () => {
  router.go(-1);
};

const onAddStation = async (station: Station) => {
  stations.value.push(station);
  try {
    await stationDB.save(station);
    ElMessage.success('场站添加成功');
  } catch (e) {
    console.error('保存场站失败', e);
    ElMessage.error('保存场站失败，请重试');
  }
};

const onEditStation = async (updated: Station) => {
  const idx = stations.value.findIndex((f) => f.id === updated.id);
  if (idx === -1) {
    ElMessage.error('未找到对应场站');
    return;
  }
  // 用 splice 替换确保 Vue 响应式正确触发
  stations.value.splice(idx, 1, updated);
  try {
    await stationDB.save(updated);
    ElMessage.success('场站已更新');
  } catch (e) {
    console.error('更新场站失败', e);
    ElMessage.error('更新场站失败，请重试');
  }
};

// StationAside 保存 MCU 后同步父级缓存，并按稳定的 MCU id 刷新一次图中的绑定快照。
// 编辑 SN / IP / 端口等属性不会改变 MCU id，因此一次图仍保持原绑定，无需再次手动绑定。
const onMcuSaved = async (stationId: string, mcus: McuItem[]) => {
  replaceStationMcus(stationId, mcus);

  const stationIndex = stations.value.findIndex((station) => station.id === stationId);
  if (stationIndex < 0) return;

  const station = stations.value[stationIndex];
  const mcuById = new Map(mcus.map((mcu) => [mcu.id, mcu]));
  let hasUpdatedBinding = false;
  const nextDiagrams = station.diagrams.map((diagram) => {
    if (!diagram.boundMcuId) return diagram;
    const boundMcu = mcuById.get(diagram.boundMcuId);
    if (!boundMcu) return diagram;
    hasUpdatedBinding = true;
    return { ...diagram, boundMcuInfo: { ...boundMcu } };
  });

  if (!hasUpdatedBinding) return;

  const updatedStation: Station = { ...station, diagrams: nextDiagrams };
  stations.value.splice(stationIndex, 1, updatedStation);
  try {
    await stationDB.save(updatedStation);
  } catch (e) {
    // MCU 本身已经保存成功；这里只回滚未能持久化的一次图快照。
    stations.value.splice(stationIndex, 1, station);
    console.error('同步一次图的 MCU 绑定信息失败', e);
    ElMessage.error('MCU已保存，但同步一次图绑定信息失败，请重试');
  }
};

const onDeleteStation = async (stationId: string) => {
  stations.value = stations.value.filter((f) => f.id !== stationId);
  if (stationId === currentStationId.value) {
    // 删除的正是当前场站，清理持久化上下文并重置内存状态
    clearPersistedContext();
    currentStationId.value = '';
    drawingDiagram.value = null;
  }
  try {
    await stationDB.remove(stationId);
    // 同步清理该场站绑定的 MCU 数据
    await mcuDB.removeByStation(stationId);
  } catch (e) {
    console.error('删除场站失败', e);
    ElMessage.error('删除场站失败');
  }
};

const onDeleteDiagram = async (stationId: string, diagramId: string) => {
  const station = stations.value.find((f) => f.id === stationId);
  if (station) {
    station.diagrams = station.diagrams.filter((f) => f.id !== diagramId);
    if (
      drawingDiagram.value?.stationId === stationId &&
      drawingDiagram.value?.diagramId === diagramId
    ) {
      // 删除的正是当前编辑的一次图，清理持久化上下文并重置内存状态
      clearPersistedContext();
      currentStationId.value = '';
      drawingDiagram.value = null;
    }
    try {
      await stationDB.save(station);
    } catch (e) {
      console.error('更新场站失败', e);
      ElMessage.error('删除一次图失败');
    }
  }
};

const onEditDiagram = async (payload: {
  stationId: string;
  diagramId: string;
  name: string;
  remark: string;
}) => {
  const stationIndex = stations.value.findIndex((f) => f.id === payload.stationId);
  if (stationIndex < 0) {
    ElMessage.error('未找到目标场站');
    return;
  }
  const station = stations.value[stationIndex];
  const diagram = station.diagrams.find((d) => d.id === payload.diagramId);
  if (!diagram) {
    ElMessage.error('未找到目标一次图');
    return;
  }
  diagram.name = payload.name;
  diagram.remark = payload.remark || '';
  diagram.updateTime = Date.now();

  if (
    drawingDiagram.value?.stationId === payload.stationId &&
    drawingDiagram.value?.diagramId === payload.diagramId
  ) {
    drawingDiagram.value.name = payload.name;
    drawingDiagram.value.remark = payload.remark;
    persistCurrentContext();
  }

  const updatedStation: Station = { ...station };
  stations.value.splice(stationIndex, 1, updatedStation);

  try {
    await stationDB.save(updatedStation);
    ElMessage.success('一次图信息已更新');
  } catch (e) {
    console.error('更新一次图失败', e);
    ElMessage.error('更新一次图失败');
  }
};

// 将选中的 MCU 详细信息绑定至指定一次图，并持久化到数据库。
// 采用不可变更新（splice 替换）确保 Vue 响应式触发，失败时回滚内存状态。
const onBindDiagramMcu = async (stationId: string, diagramId: string, mcu: McuItem) => {
  const stationIndex = stations.value.findIndex((s) => s.id === stationId);
  if (stationIndex < 0) {
    ElMessage.error('未找到当前场站信息');
    return;
  }
  const station = stations.value[stationIndex];
  const diagramIndex = station.diagrams.findIndex((d) => d.id === diagramId);
  if (diagramIndex < 0) {
    ElMessage.error('未找到目标一次图');
    return;
  }
  const now = Date.now();
  const nextDiagrams = station.diagrams.map((d, i) =>
    i === diagramIndex ? { ...d, boundMcuId: mcu.id, boundMcuInfo: { ...mcu }, updateTime: now } : d
  );
  const updatedStation: Station = { ...station, diagrams: nextDiagrams };
  stations.value.splice(stationIndex, 1, updatedStation);
  try {
    await stationDB.save(updatedStation);
    ElMessage.success(`已将 MCU（SN：${mcu.sn}）绑定至一次图`);
  } catch (e) {
    // 写库失败回滚内存状态，保证内存与数据库一致
    stations.value.splice(stationIndex, 1, station);
    console.error('绑定MCU失败', e);
    ElMessage.error('绑定MCU失败，请重试');
  }
};

const loadDiagram = (stationId: string, diagramId: string) => {
  // 预加载该场站绑定的 MCU，使底部状态栏连接状态能基于 MCU 的 IP 派生
  ensureStationMcus(stationId);
  const station = stations.value.find((f) => f.id === stationId);
  const diagram = station?.diagrams.find((f) => f.id === diagramId);
  if (!diagram) {
    ElMessage.error('未找到一次图数据');
    return;
  }
  const exportJson = diagram.exportJson as unknown as IExportJson;
  const { canvasCfg, gridCfg, importDoneJson } = useExportJsonToDoneJson(exportJson);
  // 重置视图
  canvasCfg.transform_origin = { x: 0, y: 0 };
  canvasCfg.drag_offset = { x: 0, y: 0 };
  globalStore.canvasCfg = canvasCfg;
  // 保存加载时的初始画布配置快照，供复位功能使用
  globalStore.initialCanvasCfg = objectDeepClone(canvasCfg);
  globalStore.gridCfg = gridCfg;
  globalStore.setGlobalStoreDoneJson(importDoneJson);
  cacheStore.history = [importDoneJson];
  cacheStore.historyIndex = 0;
  captureSavedCanvasSnapshot();
  // 记录当前正在编辑的一次图，使保存时能更新原图
  drawingDiagram.value = { stationId, diagramId };
  currentStationId.value = stationId;
  // 持久化当前场站上下文，避免组件重挂载后丢失“进入场站”状态
  persistCurrentContext();
  ElMessage.success('一次图加载成功');
};

const onLoadDiagram = async (stationId: string, diagramId: string) => {
  if (
    drawingDiagram.value?.stationId === stationId &&
    drawingDiagram.value?.diagramId === diagramId
  ) {
    return;
  }

  if (!(await confirmCanvasTransition())) return;

  loadDiagram(stationId, diagramId);
};

const onRequestAddDiagram = async (openDialog: () => void) => {
  if (!(await confirmCanvasTransition())) return;
  openDialog();
};

// 进入场站：加载该场站的首张一次接线图
const onEnterStation = (stationId: string) => {
  const station = stations.value.find((f) => f.id === stationId);
  if (!station) {
    ElMessage.error('未找到对应场站');
    return;
  }
  if (!station.diagrams.length) {
    ElMessage.warning('该场站暂无一次图');
    return;
  }
  onLoadDiagram(stationId, station.diagrams[0].id);
};

const onExportStations = async () => {
  try {
    const list = await stationDB.loadAll();
    const payload = {
      type: 'maotu-stations-package',
      version: 1,
      exportedAt: Date.now(),
      stations: list
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    a.download = `场站工程包_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
      d.getHours()
    )}${pad(d.getMinutes())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success(`已导出场站工程包（${list.length} 个场站）`);
  } catch (e) {
    console.error('导出场站工程包失败', e);
    ElMessage.error('导出场站工程包失败');
  }
};

const onExportDiagram = (stationId: string, diagramId: string) => {
  try {
    const station = stations.value.find((f) => f.id === stationId);
    if (!station) {
      ElMessage.error('未找到当前场站信息');
      return;
    }
    const diagram = station.diagrams.find((d) => d.id === diagramId);
    if (!diagram) {
      ElMessage.error('未找到当前一次接线图');
      return;
    }
    // 合并：当前行（一次图）元数据 + 关联的一次图 JSON（diagram.exportJson）
    const payload = {
      type: 'maotu-diagram-package',
      version: 1,
      exportedAt: Date.now(),
      stationId: station.id,
      stationName: station.name,
      diagram: diagram
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fileName = `${station.name || station.id}_${
      diagram.name || diagram.id
    }_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(
      d.getMinutes()
    )}.json`;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success(`已导出一次图「${diagram.name || diagram.id}」`);
  } catch (e) {
    console.error('导出一次图失败', e);
    ElMessage.error('导出一次图失败');
  }
};

const onImportDiagram = async (stationId: string, diagram: StationDiagram) => {
  try {
    const stationIndex = stations.value.findIndex((f) => f.id === stationId);
    if (stationIndex < 0) {
      ElMessage.error('未找到目标场站，导入失败');
      return;
    }
    const station = stations.value[stationIndex];
    // 规则3（图纸校验）：同一场站下禁止同名一次图；同 id 导入视为覆盖更新，排除自身后查重
    const dup = await validateDiagramNameUnique(stationId, diagram.name, diagram.id);
    if (!dup.ok) {
      ElMessage.error(`导入失败，${dup.summary}`);
      return;
    }
    // 合并：同 id 则覆盖，否则追加，写入完整性以本地数据库为准
    const existsIdx = station.diagrams.findIndex((d) => d.id === diagram.id);
    const nextDiagrams = [...station.diagrams];
    if (existsIdx >= 0) {
      nextDiagrams.splice(existsIdx, 1, diagram);
    } else {
      nextDiagrams.push(diagram);
    }
    const updatedStation: Station = { ...station, diagrams: nextDiagrams };
    stations.value.splice(stationIndex, 1, updatedStation);
    try {
      await stationDB.save(updatedStation);
    } catch (error) {
      // 数据库写入失败，回滚内存状态，保证内存与数据库一致
      stations.value.splice(stationIndex, 1, station);
      throw error;
    }
    stations.value = await stationDB.loadAll();
    ElMessage.success(`已导入一次图「${diagram.name || diagram.id}」并保存至本地数据库`);
  } catch (e) {
    console.error('导入一次图写库失败', e);
    ElMessage.error('导入失败，数据未能保存到本地数据库');
  }
};

const onImportStations = async (file: File) => {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data?.stations;
    if (!Array.isArray(list)) {
      ElMessage.error('文件格式不正确，未找到场站数据');
      return;
    }
    let count = 0;
    const rejected: string[] = [];
    for (const item of list) {
      if (!item || typeof item.id !== 'string' || !Array.isArray(item.diagrams)) {
        continue;
      }
      // 去重校验（规则1+规则3）：同名场站（排除同 id 覆盖更新）、
      // 场站内部同名一次图均禁止导入；因逐条 await 保存，同一文件内的同名数据也会被拦截
      const dup = await validateStationImport(item as Station);
      if (!dup.ok) {
        rejected.push(...dup.errors.map((e) => e.message));
        continue;
      }
      await stationDB.save(item as Station);
      count++;
    }
    stations.value = await stationDB.loadAll();
    if (rejected.length) {
      ElMessage.warning(
        `已导入 ${count} 个场站，跳过 ${rejected.length} 项重复数据：${rejected.join('；')}`
      );
    } else {
      ElMessage.success(`已导入 ${count} 个场站工程包`);
    }
  } catch (e) {
    console.error('导入场站工程包失败', e);
    ElMessage.error('导入失败，文件格式不正确');
  }
};

const onAddDiagram = async (payload: AddDiagramPayload) => {
  const stationIndex = stations.value.findIndex((f) => f.id === payload.stationId);
  if (stationIndex < 0) {
    ElMessage.error('未找到目标场站');
    return;
  }
  const station = stations.value[stationIndex];
  const diagramId = 'diagram-' + randomString();

  const defaultCanvasCfg = createDefaultCanvasCfg();
  const defaultExportJson: IExportJson = {
    canvasCfg: defaultCanvasCfg,
    gridCfg: { enabled: false, align: true, size: 10 },
    json: []
  };

  // 清空画布，准备绘制新的一次图
  globalStore.canvasCfg = defaultCanvasCfg;
  globalStore.initialCanvasCfg = objectDeepClone(defaultCanvasCfg);
  globalStore.gridCfg = { enabled: false, align: true, size: 10 };
  globalStore.setGlobalStoreDoneJson([]);
  cacheStore.history = [[]];
  cacheStore.historyIndex = 0;

  drawingDiagram.value = {
    stationId: payload.stationId,
    diagramId,
    name: payload.name,
    remark: payload.remark
  };
  currentStationId.value = payload.stationId;

  // 尝试生成新一次图初始缩略图
  let thumbnail = '';
  try {
    thumbnail = (await genCanvasDataUrl()) || '';
  } catch (e) {
    console.warn('生成初始缩略图跳过', e);
  }

  const now = Date.now();
  const newDiagram: StationDiagram = {
    id: diagramId,
    name: payload.name,
    remark: payload.remark || '',
    thumbnail,
    exportJson: defaultExportJson as unknown as Record<string, unknown>,
    boundDeviceCount: 0,
    unboundDeviceCount: 0,
    published: false,
    createTime: now,
    updateTime: now
  };

  const nextDiagrams = [...station.diagrams, newDiagram];
  const updatedStation: Station = { ...station, diagrams: nextDiagrams };
  stations.value.splice(stationIndex, 1, updatedStation);

  try {
    await stationDB.save(updatedStation);
    captureSavedCanvasSnapshot(defaultExportJson);
    persistCurrentContext();
    ElMessage.success(`一次接线图「${payload.name}」已添加并选中`);
  } catch (e) {
    // 数据库保存失败，回滚内存状态
    stations.value.splice(stationIndex, 1, station);
    console.error('保存新一次图失败', e);
    ElMessage.error('创建一次图失败，请重试');
  }
};

const onSaveDiagram = async (exportJson: IExportJson): Promise<boolean> => {
  if (!drawingDiagram.value) {
    return false;
  }
  const thumbnail = await genCanvasDataUrl();
  if (!thumbnail) {
    ElMessage.error('生成缩略图失败');
    return false;
  }
  const station = stations.value.find((f) => f.id === drawingDiagram.value!.stationId);
  if (!station) {
    drawingDiagram.value = null;
    return false;
  }
  const diagramId = drawingDiagram.value.diagramId;
  const existingDiagram = station.diagrams.find((f) => f.id === diagramId);
  const diagramName = `一次接线图 ${new Date().toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
  const now = Date.now();
  const bindingStats = collectDeviceBindingStats(exportJson);
  const diagram: StationDiagram = {
    // 更新画布时保留 MCU 绑定等一次图元数据，只覆盖本次保存实际变更的字段。
    // 若是新建一次图，展开 undefined 不会写入任何属性。
    ...existingDiagram,
    id: diagramId,
    // 新增时优先使用弹窗填写的名称；更新已有图时保留原名称。
    // 注意用 || 而非 ??：空字符串 "" 不是 nullish，用 ?? 会原样存为 ""，
    // 导致列表回退显示 id；用 || 时空名称会落到可读的 diagramName，绝不会显示 id。
    name: existingDiagram?.name || drawingDiagram.value?.name || diagramName,
    // 备注同样优先使用弹窗填写内容，更新时保留原备注
    remark: existingDiagram?.remark || drawingDiagram.value?.remark || '',
    thumbnail,
    exportJson: exportJson as unknown as Record<string, unknown>,
    boundDeviceCount: bindingStats.boundDeviceCount,
    unboundDeviceCount: bindingStats.unboundDeviceCount,
    published: existingDiagram?.published ?? false,
    createTime: existingDiagram?.createTime ?? now,
    // 最新更新时间：首次创建时取创建时间，更新时刷新为当前修改时间
    updateTime: now
  };
  if (existingDiagram) {
    const idx = station.diagrams.findIndex((f) => f.id === diagramId);
    station.diagrams.splice(idx, 1, diagram);
  } else {
    station.diagrams.push(diagram);
  }
  try {
    await stationDB.save(station);
    captureSavedCanvasSnapshot(exportJson);
    // 保存成功后一次图已落库，重新持久化上下文（确保下次重挂载可完整恢复画布）
    persistCurrentContext();
    ElMessage.success('一次图保存成功');
    return true;
  } catch (e) {
    console.error('保存一次图失败', e);
    ElMessage.error('保存一次图失败，请重试');
    return false;
  }
};

const onThumbnailClick = (format: 'default' | 'svg' = 'default') => {
  if (format === 'svg') {
    useGenSvgThumbnail();
    return;
  }
  useGenThumbnail();
};
</script>

<template>
  <div class="edit-page">
    <div class="editor-shell">
      <mt-edit
        ref="mtEditRef"
        :use-thumbnail="true"
        :export-extra="exportExtra"
        :current-diagram-update-time="currentDiagramUpdateTime"
        :current-station-ip="currentStationIp"
        :current-station-name="currentStationName"
        :current-diagram-name="currentDiagramName"
        @on-preview-click="onPreviewClick"
        @on-import-success="onImportSuccess"
        @on-return-click="onReturnClick"
        @on-save-click="onSaveClick"
        @on-thumbnail-click="onThumbnailClick"
        @on-publish-click="onPublishClick"
        @on-device-template-change="onDeviceTemplateChange"
        @on-connection-status-change="connectionStatus = $event"
      >
        <template #stationAside>
          <station-aside
            :stations="stations"
            :active-station-id="drawingDiagram?.stationId"
            :active-diagram-id="drawingDiagram?.diagramId"
            @add-station="onAddStation"
            @edit-station="onEditStation"
            @add-diagram="onAddDiagram"
            @request-add-diagram="onRequestAddDiagram"
            @edit-diagram="onEditDiagram"
            @load-diagram="onLoadDiagram"
            @delete-station="onDeleteStation"
            @delete-diagram="onDeleteDiagram"
            @export-stations="onExportStations"
            @import-stations="onImportStations"
            @enter-station="onEnterStation"
            @publish-diagram="onPublishDiagram"
            @export-diagram="onExportDiagram"
            @import-diagram="onImportDiagram"
            @preview-diagram="onPreviewDiagram"
            @bind-diagram-mcu="onBindDiagramMcu"
            @mcu-saved="onMcuSaved"
          />
        </template>
        <template #deviceBind="{ item }">
          <el-form label-width="70px" label-position="left">
            <!-- <el-alert
              v-if="!canBindDeviceValue(item)"
              title="当前图元本身不展示数值，请选中文本、按钮或键值对组件绑定。卡片通常作为容器使用。"
              type="info"
              :closable="false"
              class="mb-10px"
            /> -->
            <el-form-item label="设备类型">
              <el-select
                v-model="getDeviceBind(item).deviceType"
                filterable
                clearable
                placeholder="选择设备类型"
                @change="onDeviceChange(item)"
              >
                <el-option
                  v-for="dt in deviceTypes"
                  :key="dt.name"
                  :label="`${dt.name} (${dt.typeCode})`"
                  :value="dt.name"
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="getDeviceBind(item).deviceType" label="设备列表">
              <div class="device-list-box">
                <el-button
                  type="primary"
                  size="small"
                  :loading="deviceListLoading"
                  @click="openDeviceListDialog(item)"
                >
                  加载设备列表
                </el-button>
                <el-text v-if="getDeviceBind(item).deviceId" size="small" type="success"> </el-text>
                <div>
                  已绑定：{{ getDeviceBind(item).deviceName || getDeviceBind(item).deviceId }}
                </div>
              </div>
            </el-form-item>
            <el-form-item label="属性">
              <div class="point-config-box">
                <div v-if="getSelectedPointLabels(item).length" class="point-label-list">
                  <div
                    v-for="(label, i) in getSelectedPointLabels(item)"
                    :key="i"
                    class="point-label-item"
                  >
                    {{ label }}
                  </div>
                </div>
                <el-text v-else type="info">未配置测点（由模板预设）</el-text>
                <el-button
                  type="primary"
                  size="small"
                  plain
                  :disabled="!getDeviceBind(item).deviceType"
                  @click="openDevicePointConfig(item)"
                >
                  配置测点
                </el-button>
              </div>
            </el-form-item>
            <!-- <el-form-item label="单位">
              <el-input
                :model-value="getDeviceBind(item).unit"
                disabled
                placeholder="自动取测点单位"
              />
            </el-form-item> -->
            <el-form-item v-if="getDeviceNameTargetOptions(item).length" label="键名写到">
              <el-select
                v-model="getDeviceBind(item).nameTargetAttr"
                clearable
                placeholder="选择键名写入属性"
                @change="onDeviceFieldChange(item)"
              >
                <el-option
                  v-for="target in getDeviceNameTargetOptions(item)"
                  :key="target.value"
                  :label="target.label"
                  :value="target.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="canBindDeviceValue(item)" label="值写到">
              <el-select v-model="getDeviceBind(item).targetAttr" placeholder="选择写入属性">
                <el-option
                  v-for="target in getDeviceTargetOptions(item)"
                  :key="target.value"
                  :label="target.label"
                  :value="target.value"
                />
              </el-select>
            </el-form-item>
            <!-- <el-text size="small" type="info">
              键名会写入字段 name，键值会从实时接口读取 dataKey 对应的值。
            </el-text> -->
          </el-form>
        </template>
      </mt-edit>
    </div>
    <!-- 预览弹窗：以 Modal 形式在当前页面展示，替代原有的新页面跳转 -->
    <preview-dialog v-model="previewVisible" :export-json="previewExportJson" />

    <!-- 设备列表弹窗：以表格形式列出当前设备类型下的真实设备，序号 + 设备名称，点击行即选中 -->
    <el-dialog
      v-model="deviceListDialogVisible"
      title="选择设备"
      width="560px"
      :close-on-click-modal="false"
      @opened="onDeviceListDialogOpened"
    >
      <div v-if="deviceListLoading" class="device-list-dialog-loading">加载中…</div>
      <el-empty
        v-else-if="deviceListFetched && !deviceList.length"
        description="该设备类型下暂无设备"
      />
      <el-table
        v-else
        ref="deviceListTableRef"
        :data="pagedDeviceList"
        highlight-current-row
        height="360"
        class="device-list-table"
        @current-change="onDeviceListCurrentChange"
      >
        <el-table-column label="序号" width="80" align="center">
          <template #default="{ $index }">{{
            (deviceListPage - 1) * deviceListPageSize + $index + 1
          }}</template>
        </el-table-column>
        <el-table-column label="设备名称" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">{{ row.deviceName }}</template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-if="deviceListFetched && deviceList.length"
        class="device-list-pagination"
        layout="total, sizes, prev, pager, next"
        :total="deviceList.length"
        :current-page="deviceListPage"
        :page-size="deviceListPageSize"
        :page-sizes="[10, 20, 50]"
        :pager-count="5"
        @current-change="onDeviceListPageChange"
        @size-change="onDeviceListSizeChange"
      />
      <template #footer>
        <el-button @click="deviceListDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!deviceListSelectedId" @click="onConfirmDeviceSelect"
          >确定</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.edit-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.editor-shell {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.point-label-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  max-height: 180px;
  overflow-y: auto;
  padding: 6px 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-blank);
}

.point-config-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

.point-label-item {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-list-box {
  width: 100%;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 4px;
}

.device-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
  background: var(--el-fill-color-blank);
}

.device-list-item:hover {
  background: var(--el-fill-color-light);
}

.device-list-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary);
}

.device-list-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-list-id {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
