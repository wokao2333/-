<template>
  <div class="preview-shell" ref="previewShellRef">
    <div class="preview-canvas-wrapper" :style="wrapperStyle">
      <div
        ref="canvasAreaRef"
        :class="`canvasArea ${
          mtPreviewProps.canDrag ? (is_dragging_canvas ? 'cursor-grabbing' : 'cursor-grab') : ''
        } `"
        @mousedown="onMouseDown"
        @wheel="onMouseWheel"
      >
        <render-core
          v-model:done-json="done_json"
          :canvas-cfg="canvas_cfg"
          :grid-cfg="grid_cfg"
          :show-ghost-dom="false"
          :canvas-dom="canvasAreaRef"
          :global-lock="false"
          :preivew-mode="true"
          :show-popover="mtPreviewProps.showPopover"
        ></render-core>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import RenderCore from '@/components/mt-edit/components/render-core/index.vue';
import type { IExportJson } from '../mt-edit/components/types';
import { useExportJsonToDoneJson } from '../mt-edit/composables';
import type { IDoneJson } from '../mt-edit/store/types';
import { getItemAttr, previewCompareVal, setItemAttr } from '../mt-edit/utils';
import { ElMessage, ElMessageBox } from 'element-plus';
type MtPreviewProps = {
  exportJson?: IExportJson;
  canZoom?: boolean;
  canDrag?: boolean;
  showPopover?: boolean;
};
const mtPreviewProps = withDefaults(defineProps<MtPreviewProps>(), {
  canDrag: true,
  canZoom: true,
  showPopover: true
});
const emits = defineEmits(['onEventCallBack']);
const canvasAreaRef = ref();
const previewShellRef = ref<HTMLDivElement>();
const is_dragging_canvas = ref(false);
const canvas_cfg = ref({
  width: 1920,
  height: 1080,
  scale: 1,
  color: '',
  img: '',
  guide: true,
  adsorp: true,
  adsorp_diff: 3,
  transform_origin: {
    x: 0,
    y: 0
  },
  drag_offset: {
    x: 0,
    y: 0
  }
});
const grid_cfg = ref({
  enabled: true,
  align: true,
  size: 10
});
const done_json = ref<IDoneJson[]>([]);
const userScale = ref(1); // 用户手动缩放的比例（Ctrl+滚轮）

/**
 * 计算自适应缩放比例，使画布铺满整个承载容器。
 * 优先使用组件自身的容器尺寸（弹窗/局部区域场景下可自适应），
 * 退化时回退到窗口尺寸，保证独立预览页也能正常工作。
 */
const fitScale = ref(1);
const getViewportSize = () => {
  const el = previewShellRef.value;
  const w = el?.clientWidth || window.innerWidth;
  const h = el?.clientHeight || window.innerHeight;
  return { w, h };
};
const calcFitScale = () => {
  const canvasW = canvas_cfg.value.width;
  const canvasH = canvas_cfg.value.height;
  const { w: viewW, h: viewH } = getViewportSize();

  if (canvasW === 0 || canvasH === 0 || viewW === 0 || viewH === 0) return;

  // 计算宽高方向各自需要缩放到容器大小的比例
  const scaleX = viewW / canvasW;
  const scaleY = viewH / canvasH;

  // 取较小的比例，确保画布完整显示在容器中
  fitScale.value = Math.min(scaleX, scaleY);
};

let pendingFitFrame = 0;
const scheduleFitScale = async () => {
  await nextTick();
  cancelAnimationFrame(pendingFitFrame);
  pendingFitFrame = requestAnimationFrame(() => {
    pendingFitFrame = 0;
    calcFitScale();
  });
};

/**
 * 最终画布缩放比例 = 自适应比例 * 用户缩放比例
 */
const effectiveScale = computed(() => {
  return fitScale.value * userScale.value;
});

/**
 * wrapper 居中样式：使画布在视口中居中
 */
const wrapperStyle = computed(() => {
  const canvasW = canvas_cfg.value.width * effectiveScale.value;
  const canvasH = canvas_cfg.value.height * effectiveScale.value;
  const { w: viewW, h: viewH } = getViewportSize();

  const offsetX = (viewW - canvasW) / 2;
  const offsetY = (viewH - canvasH) / 2;

  return {
    paddingLeft: `${Math.max(0, offsetX)}px`,
    paddingTop: `${Math.max(0, offsetY)}px`
  };
});

const setItemAttrByID = (id: string, key: string, val: any) => {
  return setItemAttr(id, key, val, done_json.value);
};
const setItemAttrs = (info: { id: string; key: string; val: any }[]) => {
  info.forEach((f) => {
    setItemAttr(f.id, f.key, f.val, done_json.value);
  });
};
const getItemAttrByID = (id: string, key: string, val: any) => {
  return getItemAttr(id, key, done_json.value);
};
const onMouseWheel = (e: any) => {
  if (e.ctrlKey && mtPreviewProps.canZoom) {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY > 0) {
      userScale.value = Math.max(0.1, (userScale.value * 10 - 1) / 10);
    } else if (e.deltaY < 0) {
      userScale.value = Math.min(5, (userScale.value * 10 + 1) / 10);
    }
  }
};
let removePreviewDragListeners: (() => void) | null = null;
const stopPreviewCanvasDrag = () => {
  removePreviewDragListeners?.();
  removePreviewDragListeners = null;
  is_dragging_canvas.value = false;
};
const onMouseDown = (e: MouseEvent) => {
  if (!mtPreviewProps.canDrag || e.button !== 0) {
    return;
  }
  e.preventDefault();
  stopPreviewCanvasDrag();

  is_dragging_canvas.value = true;
  const start_x = e.clientX;
  const start_y = e.clientY;
  const start_offset = { ...canvas_cfg.value.drag_offset };
  const onMouseMove = (moveEvent: MouseEvent) => {
    canvas_cfg.value = {
      ...canvas_cfg.value,
      drag_offset: {
        x: start_offset.x + moveEvent.clientX - start_x,
        y: start_offset.y + moveEvent.clientY - start_y
      }
    };
  };
  const onMouseUp = () => {
    stopPreviewCanvasDrag();
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  removePreviewDragListeners = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
};
const setItemAttrByIDAsync = (id: string, key: string, val: any) => {
  setTimeout(() => {
    setItemAttrByID(id, key, val);
  }, 0);
};
(window as any).$mtElMessage = ElMessage;
(window as any).$mtElMessageBox = ElMessageBox;
(window as any).$setItemAttrByID = (id: string, key: string, val: any) =>
  setItemAttrByIDAsync(id, key, val);
(window as any).$getItemAttrByID = getItemAttrByID;
(window as any).$previewCompareVal = previewCompareVal;
(window as any).$mtEventCallBack = (type: string, item_id: string, ...args: any[]) =>
  emits('onEventCallBack', type, item_id, ...args);

const handleResize = () => {
  void scheduleFitScale();
};

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  if (mtPreviewProps.exportJson) {
    const { canvasCfg, gridCfg, importDoneJson } = useExportJsonToDoneJson(
      mtPreviewProps.exportJson
    );
    canvas_cfg.value = canvasCfg;
    grid_cfg.value = gridCfg;
    done_json.value = importDoneJson;
  }
  void scheduleFitScale();
  window.addEventListener('resize', handleResize);
  // 监听承载容器尺寸变化（弹窗尺寸/窗口调整），实时重新计算自适应缩放
  if (previewShellRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => void scheduleFitScale());
    resizeObserver.observe(previewShellRef.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  resizeObserver?.disconnect();
  resizeObserver = null;
  cancelAnimationFrame(pendingFitFrame);
  stopPreviewCanvasDrag();
});

const setImportJson = (exportJson: IExportJson) => {
  const { canvasCfg, gridCfg, importDoneJson } = useExportJsonToDoneJson(exportJson);
  canvas_cfg.value = canvasCfg;
  grid_cfg.value = gridCfg;
  done_json.value = importDoneJson;
  void scheduleFitScale();
  return true;
};
defineExpose({
  setItemAttrByID,
  setImportJson,
  setItemAttrs
});
</script>
<style scoped>
.preview-shell {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #1a1a2e;
}

.preview-canvas-wrapper {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.canvasArea {
  position: relative;
  overflow: hidden;
  transform: v-bind('`scale(${effectiveScale})`');
  transform-origin: left top;
  width: v-bind('canvas_cfg.width + "px"');
  height: v-bind('canvas_cfg.height + "px"');
  left: v-bind('canvas_cfg.drag_offset.x + "px"');
  top: v-bind('canvas_cfg.drag_offset.y + "px"');
  background-color: v-bind('canvas_cfg.color');
  background-image: v-bind('"url("+canvas_cfg.img+")"');
}
</style>
