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
        ></header-panel>
      </el-header>
      <el-container class="h-[calc(100%-45px-40px)]">
        <el-aside
          :width="aside_state.left_show ? '200px' : '0px'"
          class="dark:bg-myDarkBgColor cr-border mt-edit-aside h-1/1 select-none"
          @mousedown="mainPanelRef?.stopListenerKeyDown()"
        >
          <el-tabs v-model="left_aside_active_tab" class="mt-edit-left-tabs h-1/1 select-none">
            <el-tab-pane label="图元" name="graphic">
              <left-aside :leftAsideConfig="leftAsideStore.config"></left-aside>
            </el-tab-pane>
            <el-tab-pane label="场站" name="station">
              <slot v-if="hasStationAsideSlot" name="stationAside" />
              <div v-else class="h-1/1 flex items-center justify-center p-10px">
                <el-empty description="暂无场站内容" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-aside>
        <el-main
          class="dark:bg-myMainDarkBgColor"
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
          :width="aside_state.right_show ? '200px' : '0px'"
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
      <el-footer height="40px" class="dark:bg-myDarkBgColor ct-border select-none">
        <footer-panel></footer-panel>
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
  </div>
</template>
<script setup lang="ts">
import HeaderPanel from '@/components/mt-edit/components/layout/header-panel/index.vue';
import LeftAside from '@/components/mt-edit/components/layout/left-aside/index.vue';
import MainPanel from '@/components/mt-edit/components/layout/main-panel/index.vue';
import RightAside from '@/components/mt-edit/components/layout/right-aside/index.vue';
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
  ElTabs,
  ElTabPane,
  ElEmpty
} from 'element-plus';
import { globalStore } from '@/components/mt-edit/store/global';
import { computed, reactive, ref, useSlots } from 'vue';
import DoneTree from '@/components/mt-edit/components/done-tree/index.vue';
import { cacheStore } from './store/cache';

import { objectDeepClone } from './utils';
import { genExportJson, useExportJsonToDoneJson } from './composables';
import type { IExportJson } from './components/types';
type MtEditProps = {
  useThumbnail?: boolean;
  exportExtra?: Record<string, unknown>;
};
const mtEidtProps = withDefaults(defineProps<MtEditProps>(), {
  useThumbnail: false,
  exportExtra: () => ({})
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

.mt-edit-left-tabs {
  display: flex;
  flex-direction: column;
}

.mt-edit-left-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 10px;
}

.mt-edit-left-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.mt-edit-left-tabs :deep(.el-tab-pane) {
  height: 100%;
}
</style>
