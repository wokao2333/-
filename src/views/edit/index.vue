<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import type { IExportJson } from '@/components/mt-edit/components/types';
import { useGenThumbnail } from '@/components/mt-edit/composables/thumbnail';
import { MtEdit } from '@/export';
import { useRouter } from 'vue-router';
import { globalStore } from '@/components/mt-edit/store/global';
import { cacheStore } from '@/components/mt-edit/store/cache';
import { genCanvasDataUrl } from '@/components/mt-edit/composables/canvas-thumbnail';
import { useExportJsonToDoneJson } from '@/components/mt-edit/composables';
import { randomString } from '@/components/mt-edit/utils';
import StationAside from '@/components/mt-edit/components/layout/station-aside/index.vue';
import type {
  Station,
  StationDiagram
} from '@/components/mt-edit/components/layout/station-aside/types';
import { useStationDB } from '@/composables/useStationDB';
import {
  ElAlert,
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElText
} from 'element-plus';

import {
  attachDeviceApiConfig,
  canBindDeviceValue,
  ensureDeviceBind,
  getDeviceNameTargetOptions,
  getDeviceTargetOptions,
  getDeviceUnitTargetAttr,
  getDeviceValueColorTargetAttr,
  getPhaseValueColor,
  loadDeviceApiConfig,
  normalizeDeviceApiConfig,
  parseDeviceBindingData,
  saveDeviceApiConfig,
  setValueByPath,
  syncDeviceFieldMeta,
  type DeviceApiConfig,
  type DeviceBindableItem,
  type DeviceBindInfo,
  type DeviceBindingExportJson,
  type DeviceField,
  type DeviceInfo
} from '@/composables/useDeviceBinding';

const router = useRouter();
const devices = ref<DeviceInfo[]>([]);
const deviceFieldsMap = ref<Record<string, DeviceField[]>>({});
const deviceOptionsLoading = shallowRef(false);
const deviceOptionsError = shallowRef('');
const dataSourceVisible = ref(false);
const apiConfig = reactive<DeviceApiConfig>(loadDeviceApiConfig());
const bindingJsonText = ref('');
const parsedBindingJsonText = shallowRef('');
const allDeviceFields = computed(() => Object.values(deviceFieldsMap.value).flat());
const fetchingLoading = ref(false);
const selectedStationForFetch = ref('');
const parsedDeviceSourceName = ref('');

const stations = ref<Station[]>([]);
const drawingDiagram = ref<{ stationId: string; diagramId: string } | null>(null);
const currentStationId = ref<string>('');
const stationDB = useStationDB();

onMounted(async () => {
  try {
    const data = await stationDB.loadAll();
    stations.value = data;
  } catch (e) {
    console.error('加载场站数据失败', e);
  }
});

const clearBindingJson = () => {
  devices.value = [];
  deviceFieldsMap.value = {};
  bindingJsonText.value = '';
  parsedBindingJsonText.value = '';
  selectedStationForFetch.value = '';
  parsedDeviceSourceName.value = '';
  ElMessage.success('已清空数据');
};

/** 数据源解析后，刷新画布上所有已绑定设备的 fieldName */
const refreshAllBindingsAfterParse = () => {
  globalStore.done_json.forEach((item: any) => {
    const bind = item.deviceBind as DeviceBindInfo | undefined;
    if (!bind?.deviceId || !bind?.dataKey) return;
    const fields = deviceFieldsMap.value[bind.deviceId] || [];
    syncDeviceFieldMeta(bind, fields);
    syncDeviceBindMetaToItem(item as DeviceBindableItem);
  });
};

const parseBindingJson = (silent = false) => {
  if (!bindingJsonText.value.trim()) {
    if (!silent) {
      ElMessage.warning('请先粘贴或导入 JSON 数据');
    }
    return false;
  }

  try {
    const parsed = parseDeviceBindingData(JSON.parse(bindingJsonText.value));

    devices.value = parsed.devices;
    deviceFieldsMap.value = parsed.fieldsMap;
    parsedBindingJsonText.value = bindingJsonText.value;
    deviceOptionsError.value = '';
    refreshAllBindingsAfterParse();

    if (!silent) {
      ElMessage.success(
        `已解析 ${parsed.devices.length} 个设备，共 ${allDeviceFields.value.length} 个属性`
      );
    }

    return true;
  } catch (error) {
    deviceOptionsError.value = 'JSON 解析失败，请检查数据格式';
    parsedBindingJsonText.value = '';
    if (!silent) {
      ElMessage.error(deviceOptionsError.value);
    }
    console.error(error);
    return false;
  }
};

const buildStationBaseUrl = (station: Station): string | null => {
  if (!station.ip) {
    ElMessage.error('所选场站未配置 IP 地址');
    return null;
  }
  let base = `http://${station.ip}`;
  if (station.port) {
    base += `:${station.port}`;
  }
  if (station.baseUrl) {
    base += station.baseUrl;
  }
  return base;
};

/** 根据选中的场站 IP 调用接口获取设备列表 */
const fetchDevices = async () => {
  if (!selectedStationForFetch.value) {
    ElMessage.warning('请先选择场站');
    return;
  }
  const station = stations.value.find((f) => f.id === selectedStationForFetch.value);
  if (!station) {
    ElMessage.error('未找到所选场站');
    return;
  }
  const baseUrl = buildStationBaseUrl(station);
  if (!baseUrl) return;

  fetchingLoading.value = true;
  deviceOptionsError.value = '';

  try {
    const url = `${baseUrl}/business/microgrid/device/detail`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();

    if (json.code !== 200) {
      throw new Error(json.msg || `接口返回 code=${json.code}`);
    }

    const parsed = parseDeviceBindingData(json);
    devices.value = parsed.devices;
    deviceFieldsMap.value = parsed.fieldsMap;
    parsedBindingJsonText.value = JSON.stringify(json);
    parsedDeviceSourceName.value = station.name;
    deviceOptionsError.value = '';
    refreshAllBindingsAfterParse();
    ElMessage.success(
      `${station.name}: ${parsed.devices.length} 个设备 / ${allDeviceFields.value.length} 个属性`
    );
  } catch (error: any) {
    const msg = error?.message || String(error);
    deviceOptionsError.value = `获取设备失败: ${msg}`;
    ElMessage.error(deviceOptionsError.value);
    console.error('fetchDevices error', error);
  } finally {
    fetchingLoading.value = false;
  }
};

const loadDeviceOptions = async () => {
  // 从场站接口获取的数据已在 devices 中，只需保存配置
  if (devices.value.length > 0) {
    saveDeviceApiConfig(apiConfig);
    return;
  }
  // 兼容导入 JSON 时通过 bindingJsonText 解析的场景
  if (bindingJsonText.value.trim()) {
    deviceOptionsLoading.value = true;
    deviceOptionsError.value = '';
    try {
      parseBindingJson();
      saveDeviceApiConfig(apiConfig);
    } catch (error) {
      deviceOptionsError.value = '设备数据解析失败，请检查 JSON 格式';
      ElMessage.error(deviceOptionsError.value);
      console.error(error);
    } finally {
      deviceOptionsLoading.value = false;
    }
  }
};

const getDeviceBind = (item: DeviceBindableItem) => ensureDeviceBind(item);

const getFieldsByDeviceId = (deviceId: string) => deviceFieldsMap.value[deviceId] || [];

const getFieldsForItem = (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);

  if (!bind.deviceId) {
    return allDeviceFields.value;
  }

  return getFieldsByDeviceId(bind.deviceId);
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

const setDefaultField = (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);
  const fields = getFieldsForItem(item);

  if (!bind.dataKey && fields[0]) {
    bind.dataKey = fields[0].key;
    syncDeviceFieldMeta(bind, fields);
    syncDeviceBindMetaToItem(item);
  }
};

const onDeviceChange = async (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);

  bind.dataKey = '';
  bind.fieldName = '';
  bind.unit = '';

  if (!bind.deviceId) {
    syncDeviceBindMetaToItem(item);
    return;
  }

  setDefaultField(item);
};

const onDeviceFieldChange = (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);
  syncDeviceFieldMeta(bind, getFieldsForItem(item));
  syncDeviceBindMetaToItem(item);
};

const confirmDataSource = () => {
  if (!devices.value.length) {
    ElMessage.warning('请先选择场站并获取设备数据');
    return;
  }
  dataSourceVisible.value = false;
};

const withDeviceSourceConfig = (exportJson: IExportJson) => {
  const normalizedConfig = normalizeDeviceApiConfig(apiConfig);
  saveDeviceApiConfig(normalizedConfig);
  return attachDeviceApiConfig(exportJson, normalizedConfig);
};

const exportExtra = computed(() => ({
  deviceApiConfig: normalizeDeviceApiConfig(apiConfig)
}));

const onImportSuccess = async (exportJson: DeviceBindingExportJson) => {
  if (!exportJson.deviceApiConfig) {
    return;
  }

  Object.assign(apiConfig, normalizeDeviceApiConfig(exportJson.deviceApiConfig));
  saveDeviceApiConfig(apiConfig);
  await loadDeviceOptions();
};

interface BoundPointGroup {
  dataKeys: Set<string>;
  items: any[];
}

/** 从 exportJson 中提取已绑定设备及其测点，按 deviceId 分组 */
const extractBoundPointGroups = (exportJson: IExportJson): Record<string, BoundPointGroup> => {
  const groups: Record<string, BoundPointGroup> = {};
  for (const item of exportJson.json) {
    const bind = (item as any).deviceBind as DeviceBindInfo | undefined;
    if (!bind?.deviceId || !bind?.dataKey) continue;
    if (!groups[bind.deviceId]) {
      groups[bind.deviceId] = { dataKeys: new Set(), items: [] };
    }
    groups[bind.deviceId].dataKeys.add(bind.dataKey);
    groups[bind.deviceId].items.push(item);
  }
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

/** 将实时数据写入 exportJson 对应项的 props */
const injectRealtimeData = (
  exportJson: IExportJson,
  realtimeDataMap: Record<string, Record<string, { value: unknown; unit?: string }>>
) => {
  for (const item of exportJson.json) {
    const bind = (item as any).deviceBind as DeviceBindInfo | undefined;
    if (!bind?.deviceId || !bind?.dataKey || !bind?.targetAttr) continue;
    const deviceData = realtimeDataMap[bind.deviceId];
    if (!deviceData) continue;
    const pointData = deviceData[bind.dataKey];
    if (!pointData || pointData.value === undefined || pointData.value === null) continue;
    // targetAttr 如 props.value.val，exportJson 中 props 为 { value: '...', unit: '...' }
    const keys = bind.targetAttr.split('.');
    if (keys.length >= 2 && keys[0] === 'props') {
      (item.props as Record<string, unknown>)[keys[1]] = pointData.value;
      if (pointData.unit && (item.props as Record<string, unknown>).unit !== undefined) {
        (item.props as Record<string, unknown>).unit = pointData.unit;
      }
    }
  }
};

const onPreviewClick = async (exportJson: IExportJson) => {
  const groups = extractBoundPointGroups(exportJson);
  const groupEntries = Object.entries(groups);

  if (groupEntries.length > 0) {
    if (!currentStationId.value) {
      ElMessage.warning('未确定当前画布所属场站，无法获取实时数据，将以静态数据预览');
    } else {
      const station = stations.value.find((f) => f.id === currentStationId.value);
      const baseUrl = station ? buildStationBaseUrl(station) : null;
      if (!baseUrl) {
        ElMessage.warning('当前场站未配置 IP 地址，无法获取实时数据');
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

  sessionStorage.setItem('exportJson', JSON.stringify(withDeviceSourceConfig(exportJson)));
  const routeUrl = router.resolve({
    name: 'preview'
  });
  window.open(routeUrl.href, '_blank');
};

const onSaveClick = async (exportJson: IExportJson) => {
  if (drawingDiagram.value) {
    await onSaveDiagram(exportJson);
  } else {
    console.log(withDeviceSourceConfig(exportJson), '这是要保存的数据');
  }
};

const onPublishClick = async (exportJson: IExportJson) => {
  if (!currentStationId.value) {
    ElMessage.warning('未确定当前画布所属场站，无法发布');
    return;
  }
  const station = stations.value.find((f) => f.id === currentStationId.value);
  if (!station) {
    ElMessage.error('未找到当前场站信息');
    return;
  }
  if (!station.ip) {
    ElMessage.error('当前场站未配置 IP 地址，无法发布');
    return;
  }

  const baseUrl = buildStationBaseUrl(station);
  if (!baseUrl) return;

  const url = `${baseUrl}/business/lineDiagram/publish`;

  const requestBody = {
    clientIp: station.ip,
    designName: drawingDiagram.value?.diagramId ?? '',
    contentJson: JSON.stringify(withDeviceSourceConfig(exportJson)),
    remark: station.remark ?? ''
  };

  try {
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
    ElMessage.success('发布成功');
    console.log('发布成功', json);
  } catch (error: any) {
    const msg = error?.message || String(error);
    ElMessage.error(`发布失败: ${msg}`);
    console.error('发布失败', error);
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

const onDeleteStation = async (stationId: string) => {
  stations.value = stations.value.filter((f) => f.id !== stationId);
  try {
    await stationDB.remove(stationId);
  } catch (e) {
    console.error('删除场站失败', e);
    ElMessage.error('删除场站失败');
  }
};

const onDeleteDiagram = async (stationId: string, diagramId: string) => {
  const station = stations.value.find((f) => f.id === stationId);
  if (station) {
    station.diagrams = station.diagrams.filter((f) => f.id !== diagramId);
    try {
      await stationDB.save(station);
    } catch (e) {
      console.error('更新场站失败', e);
      ElMessage.error('删除一次图失败');
    }
  }
};

const onLoadDiagram = (stationId: string, diagramId: string) => {
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
  globalStore.gridCfg = gridCfg;
  globalStore.setGlobalStoreDoneJson(importDoneJson);
  cacheStore.history = [importDoneJson];
  cacheStore.historyIndex = 0;
  // 记录当前正在编辑的一次图，使保存时能更新原图
  drawingDiagram.value = { stationId, diagramId };
  currentStationId.value = stationId;
  ElMessage.success('一次图加载成功');
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
      d.getHours(),
    )}${pad(d.getMinutes())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success(`已导出场站工程包（${list.length} 个场站）`);
  } catch (e) {
    console.error('导出场站工程包失败', e);
    ElMessage.error('导出场站工程包失败');
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
    for (const item of list) {
      if (!item || typeof item.id !== 'string' || !Array.isArray(item.diagrams)) {
        continue;
      }
      await stationDB.save(item as Station);
      count++;
    }
    stations.value = await stationDB.loadAll();
    ElMessage.success(`已导入 ${count} 个场站工程包`);
  } catch (e) {
    console.error('导入场站工程包失败', e);
    ElMessage.error('导入失败，文件格式不正确');
  }
};

const onAddDiagram = (stationId: string) => {
  drawingDiagram.value = { stationId, diagramId: 'diagram-' + randomString() };
  currentStationId.value = stationId;
  // 清空画布，准备绘制新的一次图
  globalStore.setGlobalStoreDoneJson([]);
  cacheStore.history = [[]];
  cacheStore.historyIndex = 0;
  ElMessage.info('请在右侧画布绘制一次图，绘制完成后点击保存');
};

const onSaveDiagram = async (exportJson: IExportJson) => {
  if (!drawingDiagram.value) {
    return;
  }
  const thumbnail = await genCanvasDataUrl();
  if (!thumbnail) {
    ElMessage.error('生成缩略图失败');
    return;
  }
  const station = stations.value.find((f) => f.id === drawingDiagram.value!.stationId);
  if (!station) {
    drawingDiagram.value = null;
    return;
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
  const diagram: StationDiagram = {
    id: diagramId,
    name: existingDiagram?.name ?? diagramName,
    thumbnail,
    exportJson: exportJson as unknown as Record<string, unknown>,
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
    ElMessage.success('一次图保存成功');
  } catch (e) {
    console.error('保存一次图失败', e);
    ElMessage.error('保存一次图失败，请重试');
  }
};

const onThumbnailClick = () => {
  useGenThumbnail();
};

/* 页面挂载时不自动加载，改为用户在对话框中手动导入 JSON */
</script>

<template>
  <div class="edit-page">
    <el-dialog
      v-model="dataSourceVisible"
      title="数据源配置"
      width="560px"
      :close-on-click-modal="false"
    >
      <template #header>
        <div class="source-dialog-header">
          <span>数据源配置</span>
          <el-text v-if="devices.length" size="small" type="info" class="ml-12px">
            {{ parsedDeviceSourceName }} {{ devices.length }} 设备 /
            {{ allDeviceFields.length }} 属性
          </el-text>
        </div>
      </template>
      <div class="source-body">
        <div class="fetch-form">
          <div class="flex items-center gap-12px">
            <el-text class="whitespace-nowrap">选择场站</el-text>
            <el-select
              v-model="selectedStationForFetch"
              placeholder="请选择场站"
              class="flex-1"
              :disabled="fetchingLoading"
            >
              <el-option
                v-for="station in stations"
                :key="station.id"
                :label="station.name"
                :value="station.id"
              />
            </el-select>
            <el-button
              type="primary"
              :loading="fetchingLoading"
              :disabled="!selectedStationForFetch"
              @click="fetchDevices"
            >
              获取设备
            </el-button>
          </div>
          <el-text size="small" type="info" class="mt-8px block">
            选择场站后将根据其 IP 地址调用设备详情接口获取设备列表
          </el-text>
          <el-alert
            v-if="deviceOptionsError"
            :title="deviceOptionsError"
            type="error"
            :closable="false"
            class="mt-8px"
          />
          <div v-if="devices.length" class="device-summary mt-12px p-12px bg-light-50 rounded">
            <el-text size="small" type="primary">已加载 {{ devices.length }} 个设备</el-text>
            <div class="mt-8px max-h-160px overflow-y-auto">
              <el-text v-for="device in devices" :key="device.id" size="small" class="block mt-4px">
                {{ device.name }} ({{ device.id }})
              </el-text>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="danger" plain :disabled="!devices.length" @click="clearBindingJson">
          清空数据
        </el-button>
        <el-button type="primary" @click="confirmDataSource">确定</el-button>
      </template>
    </el-dialog>
    <div class="editor-shell">
      <mt-edit
        :use-thumbnail="true"
        :export-extra="exportExtra"
        @on-preview-click="onPreviewClick"
        @on-import-success="onImportSuccess"
        @on-return-click="onReturnClick"
        @on-save-click="onSaveClick"
        @on-thumbnail-click="onThumbnailClick"
        @on-data-source-click="dataSourceVisible = true"
        @on-publish-click="onPublishClick"
      >
        <template #stationAside>
          <station-aside
            :stations="stations"
            @add-station="onAddStation"
            @edit-station="onEditStation"
            @add-diagram="onAddDiagram"
            @load-diagram="onLoadDiagram"
            @delete-station="onDeleteStation"
            @delete-diagram="onDeleteDiagram"
            @export-stations="onExportStations"
            @import-stations="onImportStations"
          />
        </template>
        <template #deviceBind="{ item }">
          <el-form label-width="64px" label-position="left">
            <el-alert
              v-if="deviceOptionsError"
              :title="deviceOptionsError"
              type="error"
              :closable="false"
              class="mb-10px"
            />
            <el-alert
              v-if="!canBindDeviceValue(item)"
              title="当前图元本身不展示数值，请选中文本、按钮或键值对组件绑定。卡片通常作为容器使用。"
              type="info"
              :closable="false"
              class="mb-10px"
            />
            <el-form-item label="设备">
              <el-select
                v-model="getDeviceBind(item).deviceId"
                :loading="deviceOptionsLoading"
                filterable
                clearable
                placeholder="选择设备"
                @change="onDeviceChange(item)"
              >
                <el-option
                  v-for="device in devices"
                  :key="device.id"
                  :label="`${device.name} (${device.id})`"
                  :value="device.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="属性">
              <el-select
                v-model="getDeviceBind(item).dataKey"
                :loading="deviceOptionsLoading"
                filterable
                clearable
                placeholder="选择属性"
                @change="onDeviceFieldChange(item)"
              >
                <el-option
                  v-for="field in getFieldsForItem(item)"
                  :key="`${getDeviceBind(item).deviceId || 'all'}-${field.key}`"
                  :label="`${field.name}${field.unit ? ` (${field.unit})` : ''}`"
                  :value="field.key"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="单位">
              <el-input
                :model-value="getDeviceBind(item).unit"
                disabled
                placeholder="自动取测点单位"
              />
            </el-form-item>
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
            <el-text size="small" type="info">
              键名会写入字段 name，键值会从实时接口读取 dataKey 对应的值。
            </el-text>
          </el-form>
        </template>
      </mt-edit>
    </div>
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

.source-dialog-header {
  display: flex;
  align-items: center;
}

.source-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fetch-form {
  display: flex;
  flex-direction: column;
}

.device-summary {
  border: 1px solid var(--el-border-color);
}

.editor-shell {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
</style>
