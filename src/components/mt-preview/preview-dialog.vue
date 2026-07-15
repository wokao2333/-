<template>
  <el-dialog
    :model-value="modelValue"
    title="预览"
    width="90vw"
    append-to-body
    :close-on-click-modal="true"
    :show-close="true"
    class="mt-preview-dialog"
    @update:model-value="onUpdateModelValue"
    @opened="onOpened"
  >
    <div class="mt-preview-dialog__body">
      <mt-preview ref="previewRef"></mt-preview>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { ElDialog } from 'element-plus';
import MtPreview from './index.vue';
import type { IExportJson } from '../mt-edit/components/types';

type PreviewDialogProps = {
  modelValue: boolean;
  exportJson: IExportJson | null;
};
const props = withDefaults(defineProps<PreviewDialogProps>(), {
  exportJson: null
});
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const previewRef = ref<InstanceType<typeof MtPreview>>();

// 将导出数据载入预览组件；在弹窗已布局（容器尺寸确定）后调用，确保自适应缩放准确
const loadPreview = () => {
  if (props.exportJson && previewRef.value) {
    previewRef.value.setImportJson(props.exportJson);
  }
};

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      nextTick(loadPreview);
    }
  }
);
watch(
  () => props.exportJson,
  () => {
    if (props.modelValue) {
      nextTick(loadPreview);
    }
  }
);

// 弹窗打开动画结束后再次加载，避免初始布局尺寸为 0 导致缩放计算偏差
const onOpened = () => {
  nextTick(loadPreview);
};

const onUpdateModelValue = (val: boolean) => {
  emit('update:modelValue', val);
};
</script>

<style scoped>
.mt-preview-dialog__body {
  width: 100%;
  height: 100%;
  background-color: #1a1a2e;
  overflow: hidden;
}
</style>

<!--
  非 scoped 样式：preview-dialog 的 class 挂在 .el-dialog 上（是 scoped 根节点的祖先），
  因此必须用全局样式才能命中 .el-dialog / .el-dialog__body。
  通过限制弹窗高度并居中，避免弹窗超出视口导致 .el-overlay-dialog(overflow:auto) 出现滚动条。
-->
<style>
.el-overlay-dialog:has(.mt-preview-dialog) {
  display: flex;
  align-items: center;
  justify-content: center;
}
.mt-preview-dialog {
  display: flex;
  flex-direction: column;
  height: 92vh;
  margin: 0 auto;
}
.mt-preview-dialog .el-dialog__header {
  flex-shrink: 0;
}
.mt-preview-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}
</style>
