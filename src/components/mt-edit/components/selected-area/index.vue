<template>
  <div class="mt-selected-area"></div>
</template>

<script setup lang="ts">
import { ref, unref } from 'vue';
import { getCanvasXY, type CanvasTransformOrigin } from '@/components/mt-edit/utils';
import type { MouseTouchEvent } from '../types';
import type { IAreaBinfo } from './types';
type SelectedAreaProps = {
  scaleRatio: number;
  targetDom: HTMLElement | null;
  transformOrigin: CanvasTransformOrigin;
};
const selectedAreaProps = withDefaults(defineProps<SelectedAreaProps>(), {
  scaleRatio: 1,
  targetDom: null,
  transformOrigin: () => ({ x: 0, y: 0 })
});
const emits = defineEmits(['selectedAreaMouseUp']);
const area_binfo = ref<IAreaBinfo>({
  width: 0,
  height: 0,
  top: 0,
  left: 0
});

const onMouseDown = (de: MouseTouchEvent) => {
  const canvasRect = selectedAreaProps.targetDom?.getBoundingClientRect();
  // 鼠标按下时在画布逻辑坐标系中的位置
  const startPoint = getCanvasXY(
    de,
    canvasRect,
    selectedAreaProps.scaleRatio,
    selectedAreaProps.transformOrigin
  );
  const onMouseMove = (e: MouseTouchEvent) => {
    const currentPoint = getCanvasXY(
      e,
      canvasRect,
      selectedAreaProps.scaleRatio,
      selectedAreaProps.transformOrigin
    );
    const left = Math.min(startPoint.x, currentPoint.x);
    const top = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    area_binfo.value = {
      width,
      height,
      left,
      top
    };
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onMouseMove);
    document.removeEventListener('touchend', onMouseUp);
    emits('selectedAreaMouseUp', unref(area_binfo));
    area_binfo.value = {
      width: 0,
      height: 0,
      top: 0,
      left: 0
    };
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchmove', onMouseMove);
  document.addEventListener('touchend', onMouseUp);
};

defineExpose({
  onMouseDown
});
</script>
<style scoped>
.mt-selected-area {
  width: v-bind('area_binfo.width + "px"');
  height: v-bind('area_binfo.height + "px"');
  top: v-bind('area_binfo.top + "px"');
  left: v-bind('area_binfo.left + "px"');
  border: 1px solid #00699a;
  background-color: #59c7f9;
  opacity: 0.3;
  position: absolute;
}
</style>
