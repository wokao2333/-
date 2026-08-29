<template>
  <div class="flex justify-between" style="width: 100%">
    <div class="flex items-center justify-between shrink-0">
      <div class="flex items-center">
        <div
          class="pl-8px flex items-center flex-nowrap whitespace-nowrap gap-6px leading-tight overflow-visible animate__animated animate__bounceIn animate__slow animate__1 animate__delay-0s"
        >
          <!-- <span class="text-16px font-bold whitespace-nowrap shrink-0">砺行能源</span> -->
          <span class="text-20px text-gray-500 whitespace-nowrap shrink-0">一次接线图组态工具</span>
          <el-tag effect="dark" round size="small" class="shrink-0 mr-10px">v2.0</el-tag>
        </div>
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
    <div class="flex justify-between flex-1">
      <div class="flex items-center">
        <el-button-group>
          <el-button
            text
            size="small"
            class="header-action-button"
            :disabled="!headerPanelProps.undoEnabled"
            @click="emits('onUndoClick')"
          >
            <el-icon :size="20">
              <svg-analysis name="undo"></svg-analysis>
            </el-icon>
            <span class="header-action-label">撤销</span>
          </el-button>
          <el-button
            text
            size="small"
            class="header-action-button"
            :disabled="!headerPanelProps.redoEnabled"
            @click="emits('onRedoClick')"
          >
            <el-icon :size="20">
              <svg-analysis name="redo"></svg-analysis>
            </el-icon>
            <span class="header-action-label">重做</span>
          </el-button>
        </el-button-group>
        <el-divider direction="vertical"></el-divider>
        <el-button
          text
          size="small"
          class="header-action-button"
          @click="emits('onResetCanvasClick')"
        >
          <el-icon :size="20">
            <svg-analysis name="rotate"></svg-analysis>
          </el-icon>
          <span class="header-action-label">复位</span>
        </el-button>
        <el-divider direction="vertical"></el-divider>
        <el-button
          text
          size="small"
          class="header-action-button"
          :disabled="!headerPanelProps.deleteEnabled"
          @click="onDeleteClick"
        >
          <el-icon :class="``" :size="20">
            <svg-analysis name="delete"></svg-analysis>
          </el-icon>
          <span class="header-action-label">删除</span>
        </el-button>
        <el-divider direction="vertical"></el-divider>
        <el-button text size="small" class="header-action-button" @click="onTreeClick">
          <el-icon :size="20">
            <svg-analysis name="tree-list"></svg-analysis>
          </el-icon>
          <span class="header-action-label">组件树</span>
        </el-button>

        <el-divider direction="vertical"></el-divider>
        <el-popover
          placement="bottom"
          :width="240"
          trigger="hover"
          :disabled="!headerPanelProps.alignEnabled"
        >
          <template #reference>
            <span
              class="inline-flex"
              :title="
                headerPanelProps.alignEnabled ? undefined : '请至少选择两个非连线图元进行对齐'
              "
            >
              <el-button
                text
                size="small"
                class="header-action-button"
                aria-label="对齐"
                :disabled="!headerPanelProps.alignEnabled"
              >
                <el-icon :size="20">
                  <svg-analysis name="align"></svg-analysis>
                </el-icon>
                <span class="header-action-label">对齐</span>
              </el-button>
            </span>
          </template>
          <div class="flex justify-center">
            <el-button-group>
              <el-button
                text
                size="small"
                class="header-action-button"
                @click="alignSelected('left')"
              >
                <el-icon :size="20">
                  <svg-analysis name="align-left"></svg-analysis>
                </el-icon>
                <span class="header-action-label">左对齐</span>
              </el-button>
              <el-button
                text
                size="small"
                class="header-action-button"
                @click="alignSelected('right')"
              >
                <el-icon :size="20">
                  <svg-analysis name="align-right"></svg-analysis>
                </el-icon>
                <span class="header-action-label">右对齐</span>
              </el-button>
              <el-button
                text
                size="small"
                class="header-action-button"
                @click="alignSelected('horizontally')"
              >
                <el-icon :size="20">
                  <svg-analysis name="align-horizontally"></svg-analysis>
                </el-icon>
                <span class="header-action-label">水平居中</span>
              </el-button>
              <el-button
                text
                size="small"
                class="header-action-button"
                @click="alignSelected('vertically')"
              >
                <el-icon :size="20">
                  <svg-analysis name="align-vertical"></svg-analysis>
                </el-icon>
                <span class="header-action-label">垂直居中</span>
              </el-button>
            </el-button-group>
          </div>
        </el-popover>
        <el-divider direction="vertical"></el-divider>
        <el-button-group>
          <el-button
            text
            size="small"
            class="header-action-button"
            :disabled="!headerPanelProps.groupEnabled"
            @click="onGroupClick"
          >
            <el-icon :size="20">
              <svg-analysis name="group"></svg-analysis>
            </el-icon>
            <span class="header-action-label">组合</span>
          </el-button>
          <el-button
            text
            size="small"
            class="header-action-button"
            :disabled="!headerPanelProps.unGroupEnabled"
            @click="onUngroupClick"
          >
            <el-icon :size="20">
              <svg-analysis name="ungroup"></svg-analysis>
            </el-icon>
            <span class="header-action-label">取消组合</span>
          </el-button>
        </el-button-group>
        <el-divider direction="vertical" v-if="!is_npm_env"></el-divider>
        <el-popover v-if="!is_npm_env" placement="bottom" :width="220" trigger="hover">
          <template #reference>
            <el-button
              text
              size="small"
              class="header-action-button"
              aria-label="连线"
              :aria-pressed="drawline_selected"
              @click="onDrawLineClick"
            >
              <el-icon :size="20" :class="drawline_selected ? 'icon-selected' : ''">
                <svg-analysis v-if="drawline_mode === 'free'" name="pen-line"></svg-analysis>
                <span
                  v-else
                  class="rounded-line-icon"
                  :class="{ 'is-vertical': drawline_mode === 'vertical' }"
                ></span>
              </el-icon>
              <span class="header-action-label">连线</span>
            </el-button>
          </template>
          <div class="flex flex-col gap-6px">
            <div class="drawline-mode-title">连线模式</div>
            <el-button-group class="flex">
              <el-button
                text
                size="small"
                class="header-action-button flex-1"
                aria-label="自由绘制"
                :aria-pressed="drawline_mode === 'free'"
                @click="onDrawLineModeClick('free')"
              >
                <el-icon :size="20" :class="drawline_mode === 'free' ? 'icon-selected' : ''">
                  <svg-analysis name="pen-line"></svg-analysis>
                </el-icon>
                <span class="header-action-label">自由</span>
              </el-button>
              <el-button
                text
                size="small"
                class="header-action-button flex-1"
                aria-label="竖线模式：连线始终保持垂直"
                :aria-pressed="drawline_mode === 'vertical'"
                @click="onDrawLineModeClick('vertical')"
              >
                <el-icon :size="20" :class="drawline_mode === 'vertical' ? 'icon-selected' : ''">
                  <span class="rounded-line-icon is-vertical"></span>
                </el-icon>
                <span class="header-action-label">竖线</span>
              </el-button>
              <el-button
                text
                size="small"
                class="header-action-button flex-1"
                aria-label="横线模式：连线始终保持水平"
                :aria-pressed="drawline_mode === 'horizontal'"
                @click="onDrawLineModeClick('horizontal')"
              >
                <el-icon :size="20" :class="drawline_mode === 'horizontal' ? 'icon-selected' : ''">
                  <span class="rounded-line-icon"></span>
                </el-icon>
                <span class="header-action-label">横线</span>
              </el-button>
            </el-button-group>
            <div class="drawline-mode-tip">{{ drawline_mode_tip }}</div>
          </div>
        </el-popover>
      </div>
      <div class="flex justify-center items-center">
        <el-tag v-if="headerPanelProps.realTimeData.show" size="small">{{
          headerPanelProps.realTimeData.text
        }}</el-tag>
      </div>
      <div class="flex items-center mr-20px">
        <!-- <el-tooltip content="返回" placement="bottom" effect="dark">
          <el-button text circle size="small" @click="emits('onReturnClick')">
            <el-icon :size="20">
              <svg-analysis name="return"></svg-analysis>
            </el-icon>
          </el-button>
        </el-tooltip> -->
        <el-divider direction="vertical"></el-divider>
        <el-button text size="small" class="header-action-button" @click="emits('onSaveClick')">
          <el-icon :size="20">
            <svg-analysis name="save"></svg-analysis>
          </el-icon>
          <span class="header-action-label">保存</span>
        </el-button>
        <el-divider v-if="headerPanelProps.useThumbnail" direction="vertical"></el-divider>
        <el-popover
          v-if="headerPanelProps.useThumbnail"
          placement="bottom"
          :width="240"
          trigger="hover"
        >
          <template #reference>
            <el-button
              text
              size="small"
              class="header-action-button"
              aria-label="保存缩略图"
              @click="onThumbnailFormatClick('default')"
            >
              <el-icon :size="20">
                <svg-analysis name="thumbnail"></svg-analysis>
              </el-icon>
              <span class="header-action-label">缩略图</span>
            </el-button>
          </template>
          <div class="flex flex-col gap-6px">
            <div class="thumbnail-format-title">缩略图格式</div>
            <el-button-group class="flex">
              <el-button
                text
                size="small"
                class="header-action-button flex-1"
                aria-label="默认格式：导出 PNG 位图缩略图"
                @click="onThumbnailFormatClick('default')"
              >
                <el-icon :size="20">
                  <svg-analysis name="thumbnail"></svg-analysis>
                </el-icon>
                <span class="header-action-label">PNG</span>
              </el-button>
              <el-button
                text
                size="small"
                class="header-action-button flex-1"
                aria-label="SVG 格式：导出矢量缩略图"
                @click="onThumbnailFormatClick('svg')"
              >
                <el-icon :size="20">
                  <svg-analysis name="export-json"></svg-analysis>
                </el-icon>
                <span class="header-action-label">SVG</span>
              </el-button>
            </el-button-group>
          </div>
        </el-popover>
        <el-divider direction="vertical"></el-divider>
        <el-button text size="small" class="header-action-button" @click="emits('onPreviewClick')">
          <el-icon :size="20">
            <svg-analysis name="preview"></svg-analysis>
          </el-icon>
          <span class="header-action-label">预览</span>
        </el-button>
        <el-divider direction="vertical"></el-divider>
        <el-button text size="small" class="header-action-button" @click="onPublishClick">
          <el-icon :size="20">
            <Promotion />
          </el-icon>
          <span class="header-action-label">发布</span>
        </el-button>
        <el-divider direction="vertical"></el-divider>
        <!-- <el-tooltip content="在线校验" placement="bottom" effect="dark">
          <el-button text circle size="small" @click="emits('onOnlineCheckClick')">
            <el-icon :size="20">
              <Aim />
            </el-icon>
          </el-button>
        </el-tooltip> -->
      </div>
    </div>
    <div class="flex items-center justify-between w-240px shrink-0">
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
import { Promotion, Aim } from '@element-plus/icons-vue';
import {
  ElIcon,
  ElDivider,
  ElPopover,
  ElButton,
  ElButtonGroup,
  ElTag,
  ElTooltip,
  ElMessageBox
} from 'element-plus';
import SvgAnalysis from '@/components/mt-edit/components/svg-analysis/index.vue';
import type { DrawLineMode, IRealTimeData } from '@/components/mt-edit/store/types';
import { computed, ref } from 'vue';
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
  'onTreeClick',
  'alignSelected',
  'update:lockState',
  'onRedoClick',
  'onUndoClick',
  'onResetCanvasClick',
  'onPreviewClick',
  'onReturnClick',
  'onSaveClick',
  'onDrawLineClick',
  'onDrawLineModeChange',
  'onThumbnailClick',
  'onPublishClick',
  'onOnlineCheckClick'
]);
const isDark = useDark({
  selector: '#mt-edit'
});
const { isFullscreen, toggle } = useFullscreen();
const toggleDark = useToggle(isDark);
const drawline_selected = ref(false);
// 连线绘制模式：free 自由绘制（默认）；vertical 始终垂直；horizontal 始终水平
const drawline_mode = ref<DrawLineMode>('free');
const drawline_mode_tip = computed(() => {
  if (drawline_mode.value === 'vertical') return '当前：竖线模式，绘制的连线始终保持垂直';
  if (drawline_mode.value === 'horizontal') return '当前：横线模式，绘制的连线始终保持水平';
  return '当前：自由绘制，连线方向随鼠标/手指移动';
});
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

const onDrawLineClick = () => {
  drawline_selected.value = !drawline_selected.value;
  emits('onDrawLineClick', drawline_selected.value);
};
const onDrawLineModeClick = (mode: DrawLineMode) => {
  // 弹出层内直接选择模式（自由/竖线/横线），自由即为取消模式约束
  drawline_mode.value = mode;
  emits('onDrawLineModeChange', drawline_mode.value);
};
// 缩略图导出格式：default 默认导出（PNG 位图）；svg 矢量格式
type ThumbnailFormat = 'default' | 'svg';
const onThumbnailFormatClick = (format: ThumbnailFormat) => {
  emits('onThumbnailClick', format);
};
// 发布前弹出确认对话框，确认后才触发发布事件
const onPublishClick = () => {
  ElMessageBox.confirm('确定要发布当前内容吗？', '发布确认', {
    confirmButtonText: '确定发布',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      emits('onPublishClick');
    })
    .catch(() => {
      // 用户取消发布，不执行任何操作
    });
};
</script>
<style scoped>
.header-action-button {
  min-width: 42px;
  height: 42px;
  padding: 3px 6px;
}

.header-action-button :deep(> span) {
  flex-direction: column;
  gap: 2px;
}

.header-action-label {
  font-size: 11px;
  line-height: 1;
  margin-left: 0 !important;
  white-space: nowrap;
}

.icon-selected {
  background-color: #ecf5ff;
  color: #409eff;
}

.rounded-line-icon {
  display: block;
  width: 16px;
  height: 2px;
  border-radius: 1px;
  background-color: currentColor;
}

.rounded-line-icon.is-vertical {
  transform: rotate(90deg);
}

.drawline-mode-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding: 0 2px;
}

.drawline-mode-tip {
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
  padding: 0 2px;
}

.thumbnail-format-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding: 0 2px;
}

.thumbnail-format-tip {
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
  padding: 0 2px;
}
</style>
