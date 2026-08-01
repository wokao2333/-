<template>
  <div ref="previewShellRef" class="preview-shell">
    <div class="preview-canvas-wrapper">
      <div
        :class="`preview-canvas-stage ${
          mtPreviewProps.canDrag ? (is_dragging_canvas ? 'cursor-grabbing' : 'cursor-grab') : ''
        } `"
        :style="stageStyle"
        @mousedown="onMouseDown"
        @wheel="onMouseWheel"
      >
        <div ref="canvasAreaRef" class="canvasArea" :style="canvasStyle">
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
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
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
const previewShellRef = ref<HTMLDivElement | null>(null);
const canvasAreaRef = ref();
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
const previewScale = ref(1);
const previewZoomRatio = ref(1);
const previewOffset = ref({ x: 0, y: 0 });
const roundViewValue = (value: number) => Number(value.toFixed(4));

/**
 * 编辑器使用 left/top + transform-origin + scale 表示视图变换。
 * 预览统一换算成左上角原点的 translate + scale，只作用于固定尺寸的画布外层。
 */
const resetPreviewView = () => {
  const savedScale = Number(canvas_cfg.value.scale);
  const scale = Number.isFinite(savedScale) && savedScale > 0 ? savedScale : 1;
  const origin = canvas_cfg.value.transform_origin ?? { x: 0, y: 0 };
  const dragOffset = canvas_cfg.value.drag_offset ?? { x: 0, y: 0 };

  previewScale.value = scale;
  previewZoomRatio.value = 1;
  previewOffset.value = {
    x: roundViewValue(dragOffset.x + origin.x * (1 - scale)),
    y: roundViewValue(dragOffset.y + origin.y * (1 - scale))
  };
};

const stageStyle = computed(() => ({
  width: `${canvas_cfg.value.width}px`,
  height: `${canvas_cfg.value.height}px`,
  transform: `translate(${previewOffset.value.x}px, ${previewOffset.value.y}px) scale(${previewScale.value})`
}));

const canvasStyle = computed(() => {
  const { width, height, color, img } = canvas_cfg.value;
  return {
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: color,
    backgroundImage: img ? `url(${img})` : ''
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
const onMouseWheel = (e: WheelEvent) => {
  if (e.ctrlKey && mtPreviewProps.canZoom) {
    e.preventDefault();
    e.stopPropagation();
    const oldScale = previewScale.value;
    const oldRatio = previewZoomRatio.value;
    const nextRatio =
      e.deltaY > 0
        ? Math.max(0.1, (oldRatio * 10 - 1) / 10)
        : e.deltaY < 0
        ? Math.min(5, (oldRatio * 10 + 1) / 10)
        : oldRatio;
    if (nextRatio === oldRatio) return;

    const savedScale = Number(canvas_cfg.value.scale);
    const baseScale = Number.isFinite(savedScale) && savedScale > 0 ? savedScale : 1;
    const nextScale = roundViewValue(baseScale * nextRatio);
    const shellRect = previewShellRef.value?.getBoundingClientRect();
    const anchor = {
      x: e.clientX - (shellRect?.left ?? 0),
      y: e.clientY - (shellRect?.top ?? 0)
    };
    const canvasPoint = {
      x: (anchor.x - previewOffset.value.x) / oldScale,
      y: (anchor.y - previewOffset.value.y) / oldScale
    };

    previewZoomRatio.value = nextRatio;
    previewScale.value = nextScale;
    previewOffset.value = {
      x: roundViewValue(anchor.x - canvasPoint.x * nextScale),
      y: roundViewValue(anchor.y - canvasPoint.y * nextScale)
    };
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
  const start_offset = { ...previewOffset.value };
  const onMouseMove = (moveEvent: MouseEvent) => {
    previewOffset.value = {
      x: start_offset.x + moveEvent.clientX - start_x,
      y: start_offset.y + moveEvent.clientY - start_y
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

onMounted(() => {
  if (mtPreviewProps.exportJson) {
    const { canvasCfg, gridCfg, importDoneJson } = useExportJsonToDoneJson(
      mtPreviewProps.exportJson
    );
    canvas_cfg.value = canvasCfg;
    grid_cfg.value = gridCfg;
    done_json.value = importDoneJson;
    resetPreviewView();
  }
});

onUnmounted(() => {
  stopPreviewCanvasDrag();
});

const setImportJson = (exportJson: IExportJson) => {
  const { canvasCfg, gridCfg, importDoneJson } = useExportJsonToDoneJson(exportJson);
  canvas_cfg.value = canvasCfg;
  grid_cfg.value = gridCfg;
  done_json.value = importDoneJson;
  resetPreviewView();
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
  position: relative;
  width: 100%;
  height: 100%;
}

.preview-canvas-stage {
  position: absolute;
  left: 0;
  top: 0;
  flex: 0 0 auto;
  transform-origin: 0 0;
}

.canvasArea {
  position: relative;
  overflow: hidden;
}
</style>
