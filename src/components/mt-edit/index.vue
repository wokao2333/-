<template>
  <div id="mt-edit" class="relative flex-auto w-1/1 h-1/1 dark">
    <el-container class="h-1/1">
      <el-header
        height="45px"
        class="dark:bg-myDarkBgColor cb-border p-0 select-none"
        @mousedown="mainPanelRef?.stopListenerKeyDown()"
      >
        <header-panel
          v-model:leftAside="aside_state.left_show"
          v-model:rightAside="aside_state.right_show"
          v-model:lock-state="globalStore.lock"
          :selected-items-id="globalStore.selected_items_id"
          :group-enabled="header_group_enabled"
          :un-group-enabled="header_un_group_enabled"
          :align-enabled="header_align_enabled"
          :delete-enabled="header_delete_enabled"
          :undo-enabled="cacheStore.historyIndex > 0"
          :redo-enabled="cacheStore.historyIndex < cacheStore.history.length - 1"
          :real-time-data="globalStore.real_time_data"
          :use-thumbnail="mtEidtProps.useThumbnail"
          @on-group-click="mainPanelRef?.createGroupItem"
          @on-ungroup-click="mainPanelRef?.onUngroup"
          @on-delete-click="onDeleteClick"
          @on-tree-click="done_json_tree_visiable = true"
          @align-selected="onAlignSelected"
          @on-redo-click="onRedoClick"
          @on-undo-click="onUndoClick"
          @on-reset-canvas-click="onResetCanvasClick"
          @on-return-click="emits('onReturnClick')"
          @on-save-click="onSaveClick"
          @on-preview-click="onPreviewClick"
          @on-thumbnail-click="onThumbnailClick"
          @on-draw-line-click="onDrawLineClick"
          @on-data-source-click="emits('onDataSourceClick')"
          @on-publish-click="onPublishClick"
          @on-online-check-click="onOnlineCheckClick"
        ></header-panel>
      </el-header>
      <el-container class="h-[calc(100%-45px-40px)]">
        <el-aside
          :width="aside_state.left_show ? '240px' : '0px'"
          class="dark:bg-myDarkBgColor cr-border mt-edit-aside h-1/1 select-none"
          @mousedown="mainPanelRef?.stopListenerKeyDown()"
        >
          <div class="flex h-1/1">
            <div class="mt-edit-tab-bar">
              <div
                v-for="tab in tabs"
                :key="tab.name"
                :class="['mt-edit-tab-item', { active: left_aside_active_tab === tab.name }]"
                @click="left_aside_active_tab = tab.name"
              >
                <el-icon :size="20">
                  <component :is="tab.icon" />
                </el-icon>
              </div>
            </div>
            <div class="flex-1 flex flex-col h-1/1 min-w-0">
              <div class="mt-edit-panel-header">
                <!-- <el-icon :size="16">
                  <component :is="currentTab?.icon" />
                </el-icon> -->
                <span>{{ currentTab?.label }}</span>
              </div>
              <div class="flex-1 min-h-0 overflow-hidden">
                <left-aside
                  v-if="left_aside_active_tab === 'graphic'"
                  :leftAsideConfig="leftAsideStore.config"
                ></left-aside>
                <device-template
                  v-else-if="left_aside_active_tab === 'template'"
                ></device-template>
                <slot v-else-if="hasStationAsideSlot" name="stationAside" />
                <div v-else class="h-1/1 flex items-center justify-center p-10px">
                  <el-empty description="暂无场站内容" />
                </div>
              </div>
            </div>
          </div>
        </el-aside>
        <el-main
          class="bg-myMainDarkBgColor dark:bg-myMainDarkBgColor"
          @mousedown="mainPanelRef?.beginListenerKeyDown()"
          style="padding: 0"
        >
          <main-panel
            ref="mainPanelRef"
            :group-enabled="header_group_enabled"
            :un-group-enabled="header_un_group_enabled"
            :delete-enabled="header_delete_enabled"
            :line-append-enable="line_append_enable"
          ></main-panel>
        </el-main>
        <el-aside
          :width="aside_state.right_show ? '240px' : '0px'"
          class="dark:bg-myDarkBgColor cl-border mt-edit-aside select-none"
          @mousedown="mainPanelRef?.stopListenerKeyDown()"
        >
          <right-aside>
            <template v-if="hasDeviceBindSlot" #deviceBind="{ item }">
              <slot name="deviceBind" :item="item" />
            </template>
          </right-aside>
        </el-aside>
      </el-container>
      <el-footer
        height="30px"
        class="dark:bg-myDarkBgColor ct-border select-none flex items-center justify-between px-12px text-12px"
      >
        <div class="flex items-center gap-6px text-gray-500 dark:text-gray-400">
          <span class="text-gray-400">最近更新：</span>
          <span>{{ formatTime(mtEidtProps.currentDiagramUpdateTime) }}</span>
        </div>
        <div class="flex items-center gap-6px">
          <span
            class="inline-block w-8px h-8px rounded-full"
            :style="{ backgroundColor: statusColor }"
          ></span>
          <span :style="{ color: statusColor }">{{ statusText }}</span>
        </div>
      </el-footer>
    </el-container>

    <el-drawer v-model="done_json_tree_visiable" title="图形结构树" direction="ltr" size="30%">
      <done-tree
        :done-json="globalStore.done_json"
        :selected-items-id="globalStore.selected_items_id"
        @update-selected-items-id="onTreeUpdateSelectedItemsId"
        @update-selected-id-hide="onDoneTreeUpdateSelectedIdHide"
      ></done-tree>
    </el-drawer>

    <!-- 在线校验：列出当前一次接线图中所有未绑定设备，支持定位跳转 -->
    <el-dialog
      v-model="onlineCheckVisible"
      title="在线校验 - 未绑定设备"
      width="min(640px, 92vw)"
      :close-on-click-modal="false"
    >
      <el-table
        :data="unboundDevices"
        border
        stripe
        max-height="420px"
        empty-text="当前一次接线图已无未绑定设备"
      >
        <el-table-column label="序号" type="index" width="80" align="center" />
        <el-table-column label="设备名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="onLocateUnboundDevice(row.id)">
              定位
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="onlineCheckVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import HeaderPanel from '@/components/mt-edit/components/layout/header-panel/index.vue';
import LeftAside from '@/components/mt-edit/components/layout/left-aside/index.vue';
import MainPanel from '@/components/mt-edit/components/layout/main-panel/index.vue';
import RightAside from '@/components/mt-edit/components/layout/right-aside/index.vue';
import DeviceTemplate from '@/components/mt-edit/components/layout/device-template/index.vue';
import FooterPanel from '@/components/mt-edit/components/layout/footer-panel/index.vue';
import { leftAsideStore } from '@/components/mt-edit/store/left-aside';
import {
  ElContainer,
  ElHeader,
  ElAside,
  ElMain,
  ElFooter,
  ElDialog,
  ElDrawer,
  ElButton,
  ElMessage,
  ElIcon,
  ElEmpty,
  ElTable,
  ElTableColumn
} from 'element-plus';
import { Grid, OfficeBuilding, Files } from '@element-plus/icons-vue';
import { globalStore } from '@/components/mt-edit/store/global';
import { computed, onUnmounted, reactive, ref, watch, useSlots } from 'vue';
import DoneTree from '@/components/mt-edit/components/done-tree/index.vue';
import { cacheStore } from './store/cache';

import { objectDeepClone } from './utils';
import { genExportJson, useExportJsonToDoneJson } from './composables';
import { collectUnboundDevices, type UnboundDeviceItem } from '@/composables/useDeviceBinding';
import type { IExportJson } from './components/types';
type MtEditProps = {
  useThumbnail?: boolean;
  exportExtra?: Record<string, unknown>;
  /** 当前已加载一次接线图的最近更新时间（时间戳，毫秒） */
  currentDiagramUpdateTime?: number;
  /** 当前接线图所属场站的 IP 地址，用于连接状态探测 */
  currentStationIp?: string;
};
const mtEidtProps = withDefaults(defineProps<MtEditProps>(), {
  useThumbnail: false,
  exportExtra: () => ({}),
  currentDiagramUpdateTime: undefined,
  currentStationIp: ''
});
const emits = defineEmits([
  'onPreviewClick',
  'onReturnClick',
  'onSaveClick',
  'onThumbnailClick',
  'onImportSuccess',
  'onDataSourceClick',
  'onPublishClick'
]);
const slots = useSlots();
const mainPanelRef = ref<InstanceType<typeof MainPanel>>();

const aside_state = reactive({
  left_show: true,
  right_show: true
});
const hasDeviceBindSlot = computed(() => {
  return !!slots.deviceBind;
});
const hasStationAsideSlot = computed(() => {
  return !!slots.stationAside;
});
const header_delete_enabled = computed(() => {
  return globalStore.selected_items_id.length > 0;
});
const header_group_enabled = computed(() => {
  return globalStore.selected_items_id.length > 1;
});
const header_un_group_enabled = computed(() => {
  if (globalStore.selected_items_id.length === 1) {
    const item = globalStore.done_json.find((f) => f.id === globalStore.selected_items_id[0]);
    return item?.type === 'group';
  }
  return false;
});
const header_align_enabled = computed(() => {
  const selected_items = globalStore.done_json.filter(
    (f) => globalStore.selected_items_id.includes(f.id) && f.type !== 'sys-line'
  );
  return selected_items.length > 1;
});

const done_json_tree_visiable = ref(false);
const line_append_enable = ref(false);
const left_aside_active_tab = ref('graphic');

const tabs = [
  { name: 'graphic', label: '图元', icon: Grid },
  { name: 'station', label: '场站', icon: OfficeBuilding },
  { name: 'template', label: '模版', icon: Files }
];
const currentTab = computed(() => tabs.find((f) => f.name === left_aside_active_tab.value));

/* 底部状态栏：连接状态探测（浏览器无法执行 ICMP ping，改用 HTTP 可达性探测作为近似实现） */
const checking = ref(false);
const connected = ref<boolean | null>(null);
let pingTimer: number | undefined;

/** 通过向场站 IP 发起 HTTP 探测判断其是否可达：能连通即视为“已连接”，否则“未连接” */
const pingStation = async (ip: string): Promise<boolean> => {
  if (!ip) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch(`http://${ip}`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const runPing = async (ip: string) => {
  checking.value = true;
  connected.value = await pingStation(ip);
  checking.value = false;
};

watch(
  () => mtEidtProps.currentStationIp,
  (ip) => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = undefined;
    }
    if (ip) {
      runPing(ip);
      // 每 10 秒重新探测一次，保持连接状态实时性
      pingTimer = window.setInterval(() => runPing(ip), 10000);
    } else {
      connected.value = null;
      checking.value = false;
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (pingTimer) clearInterval(pingTimer);
});

const statusColor = computed(() => {
  if (checking.value) return '#E6A23C'; // 检测中：黄色
  if (connected.value === true) return '#67C23A'; // 已连接：绿色
  return '#F56C6C'; // 未连接：红色
});

const statusText = computed(() => {
  if (checking.value) return '连接检测中…';
  if (connected.value === true) return '已连接';
  return '未连接';
});

/** 将时间戳格式化为可读的最近更新时间 */
const formatTime = (ts?: number): string => {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const onDeleteClick = () => {
  globalStore.deleteSelectedItems();
  cacheStore.addHistory(globalStore.done_json);
};

const onTreeUpdateSelectedItemsId = (id: string) => {
  globalStore.setSingleSelect(id);
};
const onDoneTreeUpdateSelectedIdHide = (id: string) => {
  const item = globalStore.done_json.find((f) => f.id === id);
  if (item) {
    item.hide = !item.hide;
  }
};
const onAlignSelected = (
  type:
    | 'left'
    | 'horizontally'
    | 'right'
    | 'top'
    | 'vertically'
    | 'bottom'
    | 'horizontal-distribution'
    | 'vertical-distribution'
) => {
  mainPanelRef.value?.onAlignSelected(type);
};
const onRedoClick = () => {
  mainPanelRef.value?.onRedo();
};
const onUndoClick = () => {
  mainPanelRef.value?.onUndo();
};
const onResetCanvasClick = () => {
  mainPanelRef.value?.resetCanvasView();
};

const onPreviewClick = () => {
  // 获取导出json
  const { exportJson } = genExportJson(
    globalStore.canvasCfg,
    globalStore.gridCfg,
    globalStore.done_json
  );
  emits('onPreviewClick', exportJson);
};
const onSaveClick = () => {
  // 获取导出json
  const { exportJson } = genExportJson(
    globalStore.canvasCfg,
    globalStore.gridCfg,
    globalStore.done_json
  );
  emits('onSaveClick', exportJson);
};
const onPublishClick = () => {
  const { exportJson } = genExportJson(
    globalStore.canvasCfg,
    globalStore.gridCfg,
    globalStore.done_json
  );
  emits('onPublishClick', exportJson);
};
const onThumbnailClick = () => {
  emits('onThumbnailClick');
};
const onDrawLineClick = (val: boolean) => {
  line_append_enable.value = val;
};

/* 在线校验：基于当前一次接线图收集所有未绑定设备图元，并支持定位跳转 */
const onlineCheckVisible = ref(false);
const unboundDevices = ref<UnboundDeviceItem[]>([]);

const onOnlineCheckClick = () => {
  // 直接复用 collectUnboundDevices（已绑定/未绑定判定逻辑与统计一致），无需额外接口
  const { exportJson } = genExportJson(
    globalStore.canvasCfg,
    globalStore.gridCfg,
    globalStore.done_json
  );
  unboundDevices.value = collectUnboundDevices(exportJson);
  onlineCheckVisible.value = true;
};

// 定位未绑定设备：选中对应图元并将画布视图居中到该设备
const onLocateUnboundDevice = (id: string) => {
  mainPanelRef.value?.locateItem(id);
  onlineCheckVisible.value = false;
};
const setImportJson = (exportJson: IExportJson) => {
  const { canvasCfg, gridCfg, importDoneJson } = useExportJsonToDoneJson(exportJson);
  // 重置画布视口状态（缩放/平移），导入后回到默认画布视图
  canvasCfg.transform_origin = { x: 0, y: 0 };
  canvasCfg.drag_offset = { x: 0, y: 0 };
  globalStore.canvasCfg = canvasCfg;
  // 保存导入时的初始画布配置快照，供复位功能使用
  globalStore.initialCanvasCfg = objectDeepClone(canvasCfg);
  globalStore.gridCfg = gridCfg;
  globalStore.setGlobalStoreDoneJson(importDoneJson);
  cacheStore.history[0] = importDoneJson;
  emits('onImportSuccess', exportJson);
  return true;
};
defineExpose({
  setImportJson
});
</script>
<style scoped>
.mt-edit-aside {
  transition: width 0.3s;
}

.mt-edit-tab-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 44px;
  height: 100%;
  padding-top: 8px;
  flex-shrink: 0;
  background-color: var(--el-fill-color-light);
  border-right: 1px solid var(--el-border-color);
}

.mt-edit-tab-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: var(--el-text-color-regular);
  transition: all 0.2s;
  margin-bottom: 8px;
}

.mt-edit-tab-item:hover {
  background-color: var(--el-fill-color);
}

.mt-edit-tab-item.active {
  background-color: var(--el-color-primary);
  color: var(--el-color-white);
}

.mt-edit-panel-header {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  border-bottom: 1px solid var(--el-border-color);
}

</style>
