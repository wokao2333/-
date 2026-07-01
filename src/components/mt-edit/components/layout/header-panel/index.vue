<template>
  <div class="flex justify-between" style="width: 100%">
    <div class="flex items-center justify-between w-200px">
      <div class="flex items-center">
        <el-image class="w-45px h-45px pl-20px" :src="lxLogo" />
        <el-text
          class="pl-10px animate__animated animate__bounceIn animate__slow animate__1 animate__delay-0s"
          >LX</el-text
        >
      </div>
      <el-tooltip
        :content="headerPanelProps.leftAside ? '折叠左侧栏' : '展开左侧栏'"
        placement="bottom"
        effect="dark"
      >
        <el-button
          text
          circle
          size="small"
          @click="emits('update:leftAside', !headerPanelProps.leftAside)"
        >
          <el-icon :size="20">
            <svg-analysis v-if="headerPanelProps.leftAside" name="menu-fold"></svg-analysis>
            <svg-analysis v-else name="menu-unfold"></svg-analysis>
          </el-icon>
        </el-button>
      </el-tooltip>
    </div>
    <div class="flex justify-between" style="width: calc(100% - 440px)">
      <div class="flex items-center">
        <el-button-group>
          <el-tooltip content="撤销 (Ctrl+Z)" placement="bottom" effect="dark">
            <el-button
              text
              circle
              size="small"
              :disabled="!headerPanelProps.undoEnabled"
              @click="emits('onUndoClick')"
            >
              <el-icon :size="20">
                <svg-analysis name="undo"></svg-analysis>
              </el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="重做 (Ctrl+Y)" placement="bottom" effect="dark">
            <el-button
              text
              circle
              size="small"
              :disabled="!headerPanelProps.redoEnabled"
              @click="emits('onRedoClick')"
            >
              <el-icon :size="20">
                <svg-analysis name="redo"></svg-analysis>
              </el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>
        <el-divider direction="vertical"></el-divider>
        <el-tooltip content="删除 (Delete)" placement="bottom" effect="dark">
          <el-button
            text
            circle
            size="small"
            :disabled="!headerPanelProps.deleteEnabled"
            @click="onDeleteClick"
          >
            <el-icon :class="``" :size="20">
              <svg-analysis name="delete"></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical"></el-divider>
        <el-tooltip content="组件树" placement="bottom" effect="dark">
          <el-button text circle size="small" @click="onTreeClick">
            <el-icon :size="20">
              <svg-analysis name="tree-list"></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical"></el-divider>
        <el-button-group>
          <el-tooltip content="导入数据模型" placement="bottom" effect="dark">
            <el-button text circle size="small" @click="onImportClick">
              <el-icon :size="20">
                <svg-analysis name="import-json"></svg-analysis>
              </el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="导出数据模型" placement="bottom" effect="dark">
            <el-button text circle size="small" @click="onExportClick">
              <el-icon :size="20">
                <svg-analysis name="export-json"></svg-analysis>
              </el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>
        <el-divider direction="vertical"></el-divider>
        <el-popover
          placement="bottom"
          :width="240"
          trigger="hover"
          :disabled="!headerPanelProps.alignEnabled"
        >
          <template #reference>
            <el-tooltip
              content="对齐"
              placement="bottom"
              effect="dark"
              :disabled="headerPanelProps.alignEnabled"
            >
              <el-button text circle size="small" :disabled="!headerPanelProps.alignEnabled">
                <el-icon :size="20">
                  <svg-analysis name="align"></svg-analysis>
                </el-icon>
              </el-button>
            </el-tooltip>
          </template>
          <div class="flex justify-center">
            <el-button-group>
              <el-tooltip content="左对齐" placement="bottom" effect="dark">
                <el-button text circle size="small" @click="alignSelected('left')">
                  <el-icon :size="20">
                    <svg-analysis name="align-left"></svg-analysis>
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="水平居中" placement="bottom" effect="dark">
                <el-button text circle size="small" @click="alignSelected('horizontally')">
                  <el-icon :size="20">
                    <svg-analysis name="align-horizontally"></svg-analysis>
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="右对齐" placement="bottom" effect="dark">
                <el-button text circle size="small" @click="alignSelected('right')">
                  <el-icon :size="20">
                    <svg-analysis name="align-right"></svg-analysis>
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="上对齐" placement="bottom" effect="dark">
                <el-button text circle size="small" @click="alignSelected('top')">
                  <el-icon :size="20">
                    <svg-analysis name="align-top"></svg-analysis>
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="垂直居中" placement="bottom" effect="dark">
                <el-button text circle size="small" @click="alignSelected('vertically')">
                  <el-icon :size="20">
                    <svg-analysis name="align-vertical"></svg-analysis>
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="下对齐" placement="bottom" effect="dark">
                <el-button text circle size="small" @click="alignSelected('bottom')">
                  <el-icon :size="20">
                    <svg-analysis name="align-bottom"></svg-analysis>
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="水平分布" placement="bottom" effect="dark">
                <el-button
                  text
                  circle
                  size="small"
                  @click="alignSelected('horizontal-distribution')"
                >
                  <el-icon :size="20">
                    <svg-analysis name="horizontal-distribution"></svg-analysis>
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="垂直分布" placement="bottom" effect="dark">
                <el-button text circle size="small" @click="alignSelected('vertical-distribution')">
                  <el-icon :size="20">
                    <svg-analysis name="vertical-distribution"></svg-analysis>
                  </el-icon>
                </el-button>
              </el-tooltip>
            </el-button-group>
          </div>
        </el-popover>
        <el-divider direction="vertical"></el-divider>
        <el-button-group>
          <el-tooltip content="组合" placement="bottom" effect="dark">
            <el-button
              text
              circle
              size="small"
              :disabled="!headerPanelProps.groupEnabled"
              @click="onGroupClick"
            >
              <el-icon :size="20">
                <svg-analysis name="group"></svg-analysis>
              </el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="取消组合" placement="bottom" effect="dark">
            <el-button
              text
              circle
              size="small"
              :disabled="!headerPanelProps.unGroupEnabled"
              @click="onUngroupClick"
            >
              <el-icon :size="20">
                <svg-analysis name="ungroup"></svg-analysis>
              </el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>
        <el-divider direction="vertical"></el-divider>
        <el-tooltip content="数据源配置" placement="bottom" effect="dark">
          <el-button text circle size="small" @click="emits('onDataSourceClick')">
            <el-icon :size="20">
              <Connection />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical" v-if="!is_npm_env"></el-divider>
        <el-tooltip v-if="!is_npm_env" content="连线编辑模式" placement="bottom" effect="dark">
          <el-button text circle size="small" @click="onDrawLineClick">
            <el-icon :size="20" :class="drawline_selected ? 'icon-selected' : ''">
              <svg-analysis name="pen-line"></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>
      <div class="flex justify-center items-center">
        <el-tag v-if="headerPanelProps.realTimeData.show" size="small">{{
          headerPanelProps.realTimeData.text
        }}</el-tag>
      </div>
      <div class="flex items-center mr-20px">
        <el-tooltip content="返回" placement="bottom" effect="dark">
          <el-button text circle size="small" @click="emits('onReturnClick')">
            <el-icon :size="20">
              <svg-analysis name="return"></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical"></el-divider>
        <el-tooltip content="保存" placement="bottom" effect="dark">
          <el-button text circle size="small" @click="emits('onSaveClick')">
            <el-icon :size="20">
              <svg-analysis name="save"></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-divider v-if="headerPanelProps.useThumbnail" direction="vertical"></el-divider>
        <el-tooltip
          v-if="headerPanelProps.useThumbnail"
          content="生成缩略图"
          placement="bottom"
          effect="dark"
        >
          <el-button text circle size="small" @click="emits('onThumbnailClick')">
            <el-icon :size="20">
              <svg-analysis name="thumbnail"></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical"></el-divider>
        <el-tooltip content="预览" placement="bottom" effect="dark">
          <el-button text circle size="small" @click="emits('onPreviewClick')">
            <el-icon :size="20">
              <svg-analysis name="preview"></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>
    <div class="flex items-center justify-between w-200px">
      <el-tooltip
        :content="headerPanelProps.rightAside ? '折叠右侧栏' : '展开右侧栏'"
        placement="bottom"
        effect="dark"
      >
        <el-button
          text
          circle
          size="small"
          @click="emits('update:rightAside', !headerPanelProps.rightAside)"
        >
          <el-icon :size="20" style="cursor: pointer">
            <svg-analysis v-if="headerPanelProps.rightAside" name="menu-unfold"></svg-analysis>
            <svg-analysis v-else name="menu-fold"></svg-analysis>
          </el-icon>
        </el-button>
      </el-tooltip>
      <div class="flex items-center">
        <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏'" placement="bottom" effect="dark">
          <el-button text circle size="small" @click="toggle">
            <el-icon :size="20">
              <svg-analysis
                :name="isFullscreen ? 'exit-full-screen' : 'full-screen'"
              ></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical"></el-divider>
        <el-tooltip
          :content="headerPanelProps.lockState ? '已锁定 (点击解锁)' : '已解锁 (点击锁定)'"
          placement="bottom"
          effect="dark"
        >
          <el-button text circle size="small" @click="changeLockState">
            <el-icon :size="20">
              <svg-analysis :name="headerPanelProps.lockState ? 'lock' : 'unlock'"></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical"></el-divider>
        <el-tooltip
          :content="isDark ? '切换到日间模式' : '切换到夜间模式'"
          placement="bottom"
          effect="dark"
        >
          <el-button text circle size="small" class="mr-10px" @click="toggleDark()">
            <el-icon :size="20">
              <svg-analysis :name="isDark ? 'light' : 'dark'"></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useDark, useToggle, useFullscreen } from '@vueuse/core';
import { Connection } from '@element-plus/icons-vue';
import {
  ElIcon,
  ElDivider,
  ElPopover,
  ElButton,
  ElButtonGroup,
  ElImage,
  ElText,
  ElTag,
  ElTooltip
} from 'element-plus';
import SvgAnalysis from '@/components/mt-edit/components/svg-analysis/index.vue';
import type { IRealTimeData } from '@/components/mt-edit/store/types';
import { ref } from 'vue';
import lxLogo from '@/assets/LX.png';
type HeaderPanelProps = {
  leftAside: boolean;
  rightAside: boolean;
  selectedItemsId: string[]; //已选中组件的id
  groupEnabled: boolean;
  unGroupEnabled: boolean;
  alignEnabled: boolean;
  deleteEnabled: boolean;
  lockState: boolean;
  undoEnabled: boolean;
  redoEnabled: boolean;
  realTimeData: IRealTimeData;
  useThumbnail?: boolean;
};
const headerPanelProps = withDefaults(defineProps<HeaderPanelProps>(), {
  leftAside: true,
  rightAside: true,
  useThumbnail: false,
  selectedItemsId: () => []
});
const emits = defineEmits([
  'update:leftAside',
  'update:rightAside',
  'onGroupClick',
  'onUngroupClick',
  'onDeleteClick',
  'onExportClick',
  'onTreeClick',
  'alignSelected',
  'update:lockState',
  'onRedoClick',
  'onUndoClick',
  'onImportClick',
  'onPreviewClick',
  'onReturnClick',
  'onSaveClick',
  'onDrawLineClick',
  'onThumbnailClick',
  'onDataSourceClick'
]);
const isDark = useDark({
  selector: '#mt-edit'
});
const { isFullscreen, toggle } = useFullscreen();
const toggleDark = useToggle(isDark);
const drawline_selected = ref(false);
const is_npm_env = ref(import.meta.env.MODE === 'npm');
const onGroupClick = () => {
  emits('onGroupClick');
};
const onUngroupClick = () => {
  emits('onUngroupClick');
};
const onDeleteClick = () => {
  emits('onDeleteClick');
};
const onExportClick = () => {
  emits('onExportClick');
};
const onTreeClick = () => {
  emits('onTreeClick');
};
const alignSelected = (
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
  emits('alignSelected', type);
};
const changeLockState = () => {
  emits('update:lockState', !headerPanelProps.lockState);
};
const onImportClick = () => {
  emits('onImportClick');
};
const onDrawLineClick = () => {
  drawline_selected.value = !drawline_selected.value;
  emits('onDrawLineClick', drawline_selected.value);
};
</script>
<style scoped>
.icon-selected {
  background-color: #ecf5ff;
  color: #409eff;
}
</style>
