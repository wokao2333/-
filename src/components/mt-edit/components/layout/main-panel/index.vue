<template>
  <div class="overflow-hidden w-1/1 h-1/1" @wheel="onMouseWheel">
    <div
      id="mtCanvasArea"
      ref="canvasAreaRef"
      :class="`canvasArea  ${
        is_space_pressed || globalStore.intention == 'runDragCanvas' ? 'cursor-grab' : ''
      }`"
      @drop="onDrop"
      @dragover="onDragOver"
      @touchstart="onDrop($event, true)"
      @mousedown="onMouseDown"
      @mousemove="onCanvasMove"
      @click.right.prevent="onCanvasRightClick"
    >
      <div class="canvasContent">
        <pattern-grid
          v-if="globalStore.gridCfg.enabled"
          :grid="globalStore.gridCfg.size"
        ></pattern-grid>
        <render-core
          v-model:done-json="done_json"
          :canvas-cfg="globalStore.canvasCfg"
          :grid-cfg="globalStore.gridCfg"
          :show-ghost-dom="globalStore.selected_items_id?.length > 1 ? false : true"
          :canvas-dom="canvasAreaRef"
          :global-lock="globalStore.lock"
          :line-append-enable="mainPanelProps.lineAppendEnable"
          :canvas-drag-active="is_space_pressed"
          @on-mouse-down="onRenderCoreMouseDown"
          @on-item-move="onItemMove"
          @on-move-mouse-up="onMoveMouseUp"
          @on-item-mouse-enter="onItemMouseEnter"
          @on-item-mouse-leave="onItemMouseLeave"
          @set-intention="setIntention"
          @on-item-resize-done="onItemResizeDone"
          @on-item-rotate-done="onItemRotateDone"
          @on-item-right-click.stop="onItemRightClick"
        ></render-core>
        <selected-area
          v-show="globalStore.intention === 'beginMulSelect'"
          ref="selectedAreaRef"
          :scale-ratio="globalStore.canvasCfg.scale"
          :transform-origin="globalStore.canvasCfg.transform_origin"
          :target-dom="canvasAreaRef"
          @selected-area-mouse-up="onSelectedAreaMouseUp"
        ></selected-area>
        <drag-canvas
          ref="dragCanvasRef"
          :scale-ratio="globalStore.canvasCfg.scale"
          @drag-canvas-mouse-down="dragCanvasMouseDown"
          @drag-canvas-mouse-move="dragCanvasMouseMove"
          @drag-canvas-mouse-up="dragCanvasMouseUp"
        ></drag-canvas>
        <draw-line-render
          v-show="globalStore.intention == 'drawSysLineStart'"
          ref="dragLineRenderRef"
          v-model:item-json="draw_line_data"
          :canvas-cfg="globalStore.canvasCfg"
          :canvas-dom="canvasAreaRef"
          :grid="globalStore.gridCfg"
          :mode="'pen'"
          :line-mode="mainPanelProps.lineMode"
          @draw-line-end="onDrawLineEnd"
        ></draw-line-render>
        <div v-if="globalStore.intention == 'adsorbStart' || globalStore.intention == 'adsorbEnd'">
          <div
            v-for="item in cacheStore.adsorbPoint"
            :key="item.type"
            class="adsorb-point touch-none"
            :style="{ left: item.x + 'px', top: item.y + 'px' }"
            :data-id="item.type"
            @mouseenter="onAdsorbPointMouseEnter(item)"
            @mouseout="onAdsorbPointMouseOut()"
          ></div>
        </div>

        <div id="guide-x"></div>
        <div id="guide-y"></div>
      </div>
    </div>
    <context-menu
      :menu-info="contextMenuStore.menuInfo"
      :show="globalStore.intention == 'showContextMenu'"
      @on-context-menu-click="onContextMenuClick"
    ></context-menu>
  </div>
</template>
<script setup lang="ts">
import { globalStore, normalizeKeyboardMoveDistance } from '@/components/mt-edit/store/global';
import { createResizeBaseSize } from '@/components/mt-dzr/resize-constraints';
import { leftAsideStore } from '@/components/mt-edit/store/left-aside';
import { ElMessage } from 'element-plus';
import RenderCore from '@/components/mt-edit/components/render-core/index.vue';
import PatternGrid from '@/components/mt-edit/components/pattern-grid/index.vue';
import { computed, ref, reactive, onMounted, onUnmounted } from 'vue';
import {
  alignToGrid,
  getCanvasBinfoFromClientRect,
  getCanvasXY,
  getRealityXY,
  randomString,
  objectDeepClone,
  createGroupInfo,
  cancelGroup,
  calculateGuideY,
  calculateGuideX,
  rotatePoint,
  getRectCoordinate,
  getRectCenterCoordinate,
  handleAlign
} from '@/components/mt-edit/utils';
import type {
  AdsorbPointType,
  ContextMenuInfoType,
  DrawLineMode,
  GlobalStoreIntention,
  IDoneJson,
  ILeftAsideConfigItem
} from '@/components/mt-edit/store/types';
import SelectedArea from '@/components/mt-edit/components/selected-area/index.vue';
import type { IAreaBinfo } from '../../selected-area/types';
import { cacheStore } from '@/components/mt-edit/store/cache';
import type { onItemMoveParams } from '../../render-core/types';
import { useUpdateSysLine } from '@/components/mt-edit/composables/sys-line';
import DragCanvas from '@/components/mt-edit/components/drag-canvas/index.vue';
import ContextMenu from '@/components/mt-edit/components/context-menu/index.vue';
import { contextMenuStore } from '@/components/mt-edit/store/context-menu';
import DrawLineRender from '@/components/mt-edit/components/draw-line-render/index.vue';
import { configStore } from '@/components/mt-edit/store/config';
import { getTextBoxWidth } from './text-measure';
import { buildDeviceLabelGroup, restoreDeviceFromLabelGroup } from './device-label-group';
import {
  drawLineModeToAxisLock,
  systemLineIdToAxisLock
} from '@/components/mt-edit/utils/line-axis';
type MainPanelProps = {
  groupEnabled: boolean;
  unGroupEnabled: boolean;
  deleteEnabled: boolean;
  lineAppendEnable?: boolean;
  /** 连线绘制模式：free 自由绘制；vertical 始终垂直；horizontal 始终水平 */
  lineMode?: DrawLineMode;
};
const mainPanelProps = withDefaults(defineProps<MainPanelProps>(), {
  lineAppendEnable: false,
  lineMode: 'free'
});
const canvasAreaRef = ref();
const selectedAreaRef = ref<InstanceType<typeof SelectedArea>>();
const dragCanvasRef = ref<InstanceType<typeof DragCanvas>>();
const dragLineRenderRef = ref<InstanceType<typeof DrawLineRender>>();
const is_space_pressed = ref(false);
let is_listen_keydown = false; // 是否已经监听了键盘事件
// 画布初始偏移坐标
const init_drag_offset = reactive(globalStore.canvasCfg.drag_offset);
//如果网格关闭或者没有开启网格对齐，网格大小为1
const grid_align_size = computed(() =>
  !globalStore.gridCfg.align || !globalStore.gridCfg.enabled ? 1 : globalStore.gridCfg.size
);
const NON_SYSTEM_COMPONENT_CREATE_SCALE = 2 / 3;
const LOW_VOLTAGE_FUSE_CREATE_HEIGHT = 16;
const done_json = computed({
  get() {
    return globalStore.done_json;
  },
  set(val) {
    globalStore.setGlobalStoreDoneJson(val);
  }
});
const sys_line_init = configStore.sysComponent.find((f) => f.type == 'sys-line')!;
const getNumberPropDefault = (config: ILeftAsideConfigItem, key: string, fallback: number) => {
  const value = Number(config.props[key]?.val);

  return Number.isFinite(value) ? value : fallback;
};
const getCreateItemSize = (config: ILeftAsideConfigItem, configKey?: string) => {
  if (config.id === 'kv-vue') {
    return {
      width:
        getNumberPropDefault(config, 'labelWidth', 50) +
        getNumberPropDefault(config, 'valueWidth', 50) +
        getNumberPropDefault(config, 'unitWidth', 50) +
        getNumberPropDefault(config, 'unitGap', 4),
      height: 40
    };
  }
  // 母线图元（10KV / 400V / 600V）：默认宽度约为画布宽度的 70%，高度贴合线条粗细
  if (config.id === 'busbar-10kv' || config.id === 'busbar-400v' || config.id === 'busbar-600v') {
    const canvas_w = canvasAreaRef.value?.clientWidth || 800;
    const target = Math.round((canvas_w * 0.7) / grid_align_size.value) * grid_align_size.value;
    return { width: Math.max(target, 200), height: 24 };
  }
  // 一次设备必须按 SVG 原始尺寸创建，避免最小/最大尺寸规则造成单轴拉伸或整体缩放。
  if (configKey === '一次设备' && config.type === 'svg' && config.symbol) {
    const width = Number(config.symbol.width);
    const height = Number(config.symbol.height);
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return { width, height };
    }
  }
  // 其他分类的 SVG 使用其原始宽高比例，但限制最大初始尺寸为 50px，与一次设备图元大小接近
  if ((config.type === 'svg' || config.type === 'custom-svg') && config.symbol) {
    const w = Number(config.symbol.width) || 50;
    const h = Number(config.symbol.height) || 50;
    const MAX_SIZE = 50;
    if (w > MAX_SIZE || h > MAX_SIZE) {
      const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
      return { width: Math.max(w * ratio, 20), height: Math.max(h * ratio, 20) };
    }
    return { width: Math.max(w, 20), height: Math.max(h, 20) };
  }

  return {
    width: 50,
    height: 50
  };
};
// 设备类图元拖入画布时，默认附带一个“设备名称标签”，本质是系统组件中的文字组件。
// 该标签的位置（距图元 20px）、字体大小（30px）、颜色（白色）仅为初始默认值，
// 用户可在属性面板自由修改位置、大小、颜色等，不固定钉死。
const DEVICE_LABEL_GAP = 20;
const createDeviceLabel = (deviceItem: IDoneJson): IDoneJson => {
  const textCfg = configStore.sysComponent.find((f) => f.id === 'text-vue')!;
  const cfg = objectDeepClone<ILeftAsideConfigItem>(textCfg);
  const fontSize = 30;
  cfg.props.text.val = deviceItem.title;
  cfg.props.fontSize.val = fontSize;
  cfg.props.fill.val = '#FFFFFF';
  const labelW = getTextBoxWidth(
    deviceItem.title,
    fontSize,
    String(cfg.props.fontFamily.val || 'sans-serif')
  );
  const labelH = 40;
  const binfo = {
    left: alignToGrid(
      deviceItem.binfo.left + deviceItem.binfo.width + DEVICE_LABEL_GAP,
      grid_align_size.value
    ),
    top: alignToGrid(
      deviceItem.binfo.top + deviceItem.binfo.height / 2 - labelH / 2,
      grid_align_size.value
    ),
    width: labelW,
    height: labelH,
    angle: 0
  };
  return {
    id: 'text-vue-' + randomString(),
    title: cfg.title,
    type: cfg.type,
    binfo,
    resize_base_size: createResizeBaseSize(binfo),
    resize: true,
    rotate: true,
    lock: false,
    active: false,
    hide: false,
    use_proportional_scaling: true,
    props: cfg.props,
    tag: cfg.id,
    common_animations: cfg.common_animations,
    events: []
  };
};
const draw_line_init_data: IDoneJson = {
  id: sys_line_init.id + '-' + randomString(),
  title: sys_line_init.title,
  type: sys_line_init.type,
  binfo: {
    left: 0,
    top: 0,
    width: 100,
    height: 0,
    angle: 0
  },
  resize: false,
  rotate: false,
  lock: false,
  active: true,
  hide: false,
  props: {
    ...sys_line_init.props,
    point_position: {
      title: '点坐标',
      type: 'jsonEdit',
      val: [
        {
          x: 0,
          y: 0
        },
        {
          x: 0,
          y: 0
        }
      ],
      disabled: true
    }
  },
  tag: sys_line_init.id,
  common_animations: sys_line_init.common_animations,
  events: []
};
const draw_line_data = ref<IDoneJson>(objectDeepClone(draw_line_init_data));
// 绘制一次接线图前置校验：未添加场站时禁止在画布上绘制任意图形。
// 校验通过返回 true；不通过则提示“请先添加场站”并复位拖拽/创建意图，返回 false。
const ensureStationForDrawing = (): boolean => {
  if (globalStore.hasStation) {
    return true;
  }
  ElMessage.warning('请先添加场站');
  // 复位可能已进入的“创建/绘制”意图，避免拖拽状态残留导致后续误创建
  globalStore.setIntention('none');
  globalStore.setCreateItemInfo(null);
  globalStore.setCreateTemplateInfo(null);
  return false;
};
const onDrop = (e: DragEvent | TouchEvent, isTouch?: boolean) => {
  beginListenerKeyDown();
  if (globalStore.lock && globalStore.intention === 'create') {
    ElMessage.error('画布已锁定，请先解锁！');
    return;
  }
  e.preventDefault();
  if (isTouch && globalStore.intention !== 'create') {
    if (globalStore.lock) {
      globalStore.setIntention('beginDragCanvas');
      dragCanvasRef.value?.onMouseDown(e);
      return;
    }
    if (mainPanelProps.lineAppendEnable) {
      if (!ensureStationForDrawing()) {
        return;
      }
      globalStore.setIntention('drawSysLineStart');
      const { x, y } = getCanvasXY(
        e,
        canvasAreaRef.value?.getBoundingClientRect(),
        globalStore.canvasCfg.scale,
        globalStore.canvasCfg.transform_origin
      );
      draw_line_data.value = {
        ...objectDeepClone(draw_line_init_data),
        lineAxisLock: drawLineModeToAxisLock(mainPanelProps.lineMode),
        binfo: {
          left: alignToGrid(x, grid_align_size.value),
          top: alignToGrid(y, grid_align_size.value),
          width: 0,
          height: 0,
          angle: 0
        }
      };
      dragLineRenderRef.value?.onMouseDown(e, 1, { x: 0, y: 0 });
      return;
    }
    globalStore.cancelAllSelect();
    globalStore.setIntention('beginMulSelect');
    selectedAreaRef.value?.onMouseDown(e);
  }
  if (globalStore.intention !== 'create') {
    return;
  }
  // 前置校验：未添加场站时禁止在画布上拖入任意图形（含图元与模版组合）
  if (!ensureStationForDrawing()) {
    return;
  }
  // 从模版面板拖入组合：整体实例化到画布（递归刷新 id，避免与原模版冲突）
  if (globalStore.create_template_info) {
    const { x, y } = getCanvasXY(
      e,
      canvasAreaRef.value?.getBoundingClientRect(),
      globalStore.canvasCfg.scale,
      globalStore.canvasCfg.transform_origin
    );
    const instance = instantiateTemplateContent(
      globalStore.create_template_info,
      alignToGrid(x, grid_align_size.value),
      alignToGrid(y, grid_align_size.value)
    );
    const done_json_temp = [...globalStore.done_json];
    done_json_temp.push(instance);
    globalStore.setGlobalStoreDoneJson(done_json_temp);
    globalStore.setSingleSelect(instance.id);
    globalStore.setIntention('none');
    globalStore.setCreateTemplateInfo(null);
    cacheStore.addHistory(done_json_temp);
    return;
  }
  if (!globalStore.create_item_info) {
    console.error('拖拽初始化失败', globalStore.create_item_info);
    return;
  }
  globalStore.setSelectItems([]);
  //找到要创建图形的信息
  const find_cfg = leftAsideStore.config
    .get(globalStore.create_item_info.config_key)
    ?.find((f) => f.id === globalStore.create_item_info!.item_id);
  if (!find_cfg) {
    console.error('拖拽配置不匹配', globalStore.create_item_info, leftAsideStore.config);
    return;
  }
  const deep_find_cfg = objectDeepClone<ILeftAsideConfigItem>(find_cfg);
  // 自由连线 直角连线都有自定义宽高以及禁止缩放和旋转
  const is_line = deep_find_cfg.type === 'sys-line';
  const is_horizontal_line = deep_find_cfg.id === 'sys-line';
  const is_vertical_line = deep_find_cfg.id === 'sys-line-vertical';
  const create_item_size = getCreateItemSize(
    deep_find_cfg,
    globalStore.create_item_info.config_key
  );
  const create_item_scale =
    globalStore.create_item_info.config_key === '系统组件'
      ? 1
      : deep_find_cfg.id === '低压限流熔断器'
      ? LOW_VOLTAGE_FUSE_CREATE_HEIGHT / create_item_size.height
      : NON_SYSTEM_COMPONENT_CREATE_SCALE;
  //根据配置创建图形
  const { x, y } = getCanvasXY(
    e,
    canvasAreaRef.value?.getBoundingClientRect(),
    globalStore.canvasCfg.scale,
    globalStore.canvasCfg.transform_origin
  );
  const item_width = is_horizontal_line
    ? 100
    : is_vertical_line
    ? 0
    : create_item_size.width * create_item_scale;
  const item_height = is_vertical_line
    ? 100
    : is_horizontal_line
    ? 0
    : create_item_size.height * create_item_scale;
  const aligned_left = alignToGrid(x, grid_align_size.value);
  const aligned_top = alignToGrid(y, grid_align_size.value);
  const item_left = Math.max(
    0,
    Math.min(aligned_left, Math.max(0, globalStore.canvasCfg.width - item_width))
  );
  const item_top = Math.max(
    0,
    Math.min(aligned_top, Math.max(0, globalStore.canvasCfg.height - item_height))
  );
  const create_item: IDoneJson = {
    id: deep_find_cfg.id + '-' + randomString(),
    title: deep_find_cfg.title,
    type: deep_find_cfg.type,
    binfo: {
      left: item_left,
      top: item_top,
      width: item_width,
      height: item_height,
      angle: 0
    },
    resize_base_size: { width: item_width, height: item_height },
    resize: is_line ? false : true,
    rotate: is_line ? false : true,
    lock: false,
    active: true,
    hide: false,
    use_proportional_scaling: true,
    lineAxisLock: is_line ? systemLineIdToAxisLock(deep_find_cfg.id) : undefined,
    props: deep_find_cfg.props,
    tag: deep_find_cfg.id,
    device: deep_find_cfg.device,
    common_animations: deep_find_cfg.common_animations,
    events: []
  };
  if (deep_find_cfg.type === 'svg') {
    create_item.symbol = deep_find_cfg.symbol;
  } else if (deep_find_cfg.type === 'img') {
    create_item.thumbnail = deep_find_cfg.thumbnail;
  }
  const added_item =
    create_item.device && deep_find_cfg.attachLabel !== false
      ? buildDeviceLabelGroup(create_item, createDeviceLabel(create_item))
      : create_item;
  const done_json_temp = [...globalStore.done_json, added_item];
  globalStore.setGlobalStoreDoneJson(done_json_temp);
  globalStore.setSingleSelect(added_item.id);
  globalStore.setIntention('none');
  globalStore.setCreateItemInfo(null);
  cacheStore.addHistory(done_json_temp);
};
const onDragOver = (e: DragEvent) => {
  e.preventDefault();
};
/**
 * 将模版内容（group）实例化为画布上的一个组合：递归刷新所有 id（含嵌套子组合），
 * 并把组合整体定位到指定坐标，子元素保持相对比例不变。
 */
const instantiateTemplateContent = (content: IDoneJson, x: number, y: number): IDoneJson => {
  const regen = (item: IDoneJson): IDoneJson => {
    const copy = objectDeepClone<IDoneJson>(item);
    copy.id = (item.tag || item.type) + '-' + randomString();
    if (item.type === 'sys-line') {
      copy.props.bind_anchors.val = { start: null, end: null };
    }
    if (copy.children) {
      copy.children = copy.children.map(regen);
    }
    return copy;
  };
  const instance = regen(content);
  instance.binfo = {
    ...instance.binfo,
    left: x,
    top: y
  };
  instance.resize_base_size ??= createResizeBaseSize(instance.binfo);
  instance.active = true;
  return instance;
};
const onRenderCoreMouseDown = (item: IDoneJson, e: MouseEvent) => {
  beginListenerKeyDown();
  if (is_space_pressed.value && e.button === 0) {
    startCanvasDrag(e);
    return;
  }
  if (globalStore.lock) {
    return;
  }
  // 如果开启了吸附或参考线功能，在点击时候将所有组件目前的边界信息存到缓存中 不存系统连线的边界
  if (globalStore.canvasCfg.adsorp || globalStore.canvasCfg.guide) {
    const allBoundingInfo = globalStore.done_json
      // 如果不想让系统连线也能吸附就用下面的
      // .filter((f) => !f.hide && f.type !== 'sys-line')
      .filter((f) => !f.hide)
      .map((m) => {
        const { left, top, width, height, right, bottom } = document
          .getElementById(m.id)!
          .getBoundingClientRect();
        return {
          id: m.id,
          type: m.type,
          left,
          top,
          width,
          height,
          right,
          bottom
        };
      });
    cacheStore.setBoundingBox(allBoundingInfo);
  }
  if (!e.ctrlKey) {
    // 如果当前id已经是选中状态了 则不需要取消其它组件的激活状态 也不需要重复设置选中状态
    if (globalStore.selected_items_id.includes(item.id)) {
      return;
    }
    //将除了选中id的图形全部设置为非选中
    globalStore.setSingleSelect(item.id);
  } else if (e.ctrlKey && !item.lock) {
    const find_item = globalStore.done_json.find((f) => f.id == item.id)!;
    find_item.active = !find_item.active;
    globalStore.refreshSelectedItemsId();
  }
};
const onMouseDown = (e: MouseEvent) => {
  beginListenerKeyDown();
  if (is_space_pressed.value && e.button === 0) {
    startCanvasDrag(e);
    return;
  }
  globalStore.cancelAllSelect();
  // 锁定状态或者右键点击进行画布拖动
  if (globalStore.lock || e.button == 2) {
    globalStore.setIntention('beginDragCanvas');
    dragCanvasRef.value?.onMouseDown(e);
    return;
  }
  if (mainPanelProps.lineAppendEnable) {
    if (!ensureStationForDrawing()) {
      return;
    }
    globalStore.setIntention('drawSysLineStart');
    const { x, y } = getCanvasXY(
      e,
      canvasAreaRef.value?.getBoundingClientRect(),
      globalStore.canvasCfg.scale,
      globalStore.canvasCfg.transform_origin
    );
    draw_line_data.value = {
      ...objectDeepClone(draw_line_init_data),
      lineAxisLock: drawLineModeToAxisLock(mainPanelProps.lineMode),
      binfo: {
        left: alignToGrid(x, grid_align_size.value),
        top: alignToGrid(y, grid_align_size.value),
        width: 0,
        height: 0,
        angle: 0
      }
    };
    dragLineRenderRef.value?.onMouseDown(e, 1, { x: 0, y: 0 });
    return;
  }
  globalStore.setIntention('beginMulSelect');
  selectedAreaRef.value?.onMouseDown(e);
};
/**
 * 区域选择结束事件 之所以用getBoundingClientRect是为了处理旋转后的坐标
 * @param area_binfo 区域选择的边界信息
 */
const onSelectedAreaMouseUp = (area_binfo: IAreaBinfo) => {
  //区域选择要过滤掉锁定的组件
  const done_json_temp = [...globalStore.done_json].map((m) => {
    const bounding_info = document.getElementById(m.id)?.getBoundingClientRect();
    const canvas_area_bounding_info = canvasAreaRef.value?.getBoundingClientRect();
    let { left, top, width, height } = m.binfo;
    if (bounding_info && canvas_area_bounding_info) {
      const canvas_binfo = getCanvasBinfoFromClientRect(
        bounding_info,
        canvas_area_bounding_info,
        globalStore.canvasCfg.scale,
        globalStore.canvasCfg.transform_origin
      );
      left = canvas_binfo.left;
      top = canvas_binfo.top;
      width = canvas_binfo.width;
      height = canvas_binfo.height;
    }
    // 左右是否包含
    const contain_x = area_binfo.left < left && area_binfo.left + area_binfo.width > left + width;
    // 上下是否包含
    const contain_y = area_binfo.top < top && area_binfo.top + area_binfo.height > top + height;
    if (contain_x && contain_y && !m.lock && !m.hide) {
      m.active = true;
    }
    return m;
  });

  globalStore.setGlobalStoreDoneJson(done_json_temp);
  globalStore.refreshSelectedItemsId();
  globalStore.setIntention('none');
};
/**
 * 创建组合组件
 */
const createGroupItem = () => {
  // 根据选中的组件id，找到对应的需要组合的组件
  const selected_items = objectDeepClone<IDoneJson[]>(
    globalStore.done_json.filter((f) => globalStore.selected_items_id.includes(f.id))
  );
  // 如果选中的组件属于连线的锚点跟随组件 并且要组合的组件不包含该连线 那么取消该连线的绑定关系
  const temp_sys_lines = globalStore.done_json.filter(
    (f) =>
      f.type === 'sys-line' &&
      (globalStore.selected_items_id.includes(f.props.bind_anchors.val.start?.id) ||
        globalStore.selected_items_id.includes(f.props.bind_anchors.val.end?.id)) &&
      !globalStore.selected_items_id.includes(f.id)
  );
  temp_sys_lines.forEach((f) => {
    f.props.bind_anchors.val = {
      start: null,
      end: null
    };
  });
  const create_group_item = createGroupInfo(
    selected_items,
    canvasAreaRef.value,
    globalStore.canvasCfg.scale
  );
  const done_json_temp = [...globalStore.done_json].filter(
    (f) => !globalStore.selected_items_id.includes(f.id)
  );
  done_json_temp.push(create_group_item);
  globalStore.setGlobalStoreDoneJson(done_json_temp);
  globalStore.setSingleSelect(create_group_item.id);
  cacheStore.addHistory(globalStore.done_json);
};
const onUngroup = () => {
  // 根据选中的组件id，找到对应的需要解除组合的组件
  if (globalStore.selected_items_id.length != 1) {
    ElMessage.error('只能解除组合组件!');
    return;
  }
  const selected_item_info = globalStore.done_json.find(
    (f) => f.id === globalStore.selected_items_id[0]
  );
  if (!selected_item_info) {
    ElMessage.error('未知错误！无法找到解组信息');
    return;
  }
  if (selected_item_info.type != 'group') {
    ElMessage.error('只能解除组合组件!');
    return;
  }
  //获取拆分后的组件信息
  const split_group_items = restoreDeviceFromLabelGroup(
    selected_item_info,
    cancelGroup(
      selected_item_info,
      canvasAreaRef.value,
      globalStore.canvasCfg.scale,
      grid_align_size.value
    )
  );
  const restored_device = selected_item_info.deviceLabelGroup ? split_group_items[0] : undefined;
  const done_json_temp = [...globalStore.done_json]
    .filter((f) => !globalStore.selected_items_id.includes(f.id))
    .map((item) =>
      restored_device && item.devicePanelFor === selected_item_info.id
        ? {
            ...item,
            id: 'device-panel-' + restored_device.id,
            devicePanelFor: restored_device.id
          }
        : item
    );
  globalStore.setGlobalStoreDoneJson([...done_json_temp, ...split_group_items]);
  globalStore.setSelectItems(split_group_items.map((m) => m.id));
  cacheStore.addHistory(globalStore.done_json);
};
const onItemMove = ({ move_item_bounding_info, move_binfo }: onItemMoveParams) => {
  // 拿到画布的边界信息
  const canvas_bounding_info = canvasAreaRef.value?.getBoundingClientRect();
  // 开启了参考线或者吸附 才需要计算参考线属性和吸附距离
  if (globalStore.canvasCfg.adsorp || globalStore.canvasCfg.guide) {
    // 定义需要进行对比的缓存信息
    let cache_store_bounding_box = cacheStore.boundingBox;
    // 如果移动的是多个 只需要对比缓存数据中未移动的图形边界计算吸附距离
    if (globalStore.selected_items_id.length > 1 && move_item_bounding_info.length > 1) {
      // 从缓存里面取出所有组件的边界除去本次移动图形的其它图形边界信息 缓存里本来就没有系统连线的信息 所以这里不用过滤
      cache_store_bounding_box = cacheStore.boundingBox.filter(
        (f) => !globalStore.selected_items_id.includes(f.id)
      );
    }
    // 如果不想让系统连线也能吸附就用下面的 过滤掉多选时候连线的边界
    // const move_item_bounding_info_temp = move_item_bounding_info.filter(
    //   (f) => f.type !== 'sys-line'
    // );
    const move_item_bounding_info_temp = move_item_bounding_info;
    const { y_info, move_x } = calculateGuideY(
      cache_store_bounding_box,
      globalStore.canvasCfg.adsorp_diff,
      move_item_bounding_info_temp,
      canvas_bounding_info,
      globalStore.canvasCfg.scale
    );
    const { x_info, move_y } = calculateGuideX(
      cache_store_bounding_box,
      globalStore.canvasCfg.adsorp_diff,
      move_item_bounding_info_temp,
      canvas_bounding_info,
      globalStore.canvasCfg.scale
    );
    globalStore.guideCfg.x = x_info;
    globalStore.guideCfg.y = y_info;
    // 吸附
    if (move_x != 0 && globalStore.canvasCfg.adsorp) {
      // 把当前移动的所有组件吸附到最近的点上
      // globalStore.done_json.forEach((f) => {
      //   if (globalStore.selected_items_id.includes(f.id)) {
      //     f.binfo.left += move_x;
      //   }
      // });
      globalStore.adsorp_diff.x = move_x;
    } else {
      globalStore.adsorp_diff.x = 0;
    }
    if (move_y != 0 && globalStore.canvasCfg.adsorp) {
      // 把当前移动的所有组件吸附到最近的点上
      // globalStore.done_json.forEach((f) => {
      //   if (globalStore.selected_items_id.includes(f.id)) {
      //     f.binfo.top += move_y;
      //   }
      // });
      globalStore.adsorp_diff.y = move_y;
    } else {
      globalStore.adsorp_diff.y = 0;
    }
  }
  // 如果多选的组件里有连线，并且连线的锚点绑定对应的组件不在多选里 那么清除掉连线的绑定关系
  const clear_bind_sys_line = globalStore.done_json.filter(
    (f) =>
      f.type == 'sys-line' &&
      globalStore.selected_items_id.includes(f.id) &&
      (f.props.bind_anchors.val.start || f.props.bind_anchors.val.end)
  );
  // 循环将当前连线的绑定关系清空
  clear_bind_sys_line.forEach((f) => {
    if (f.props.bind_anchors.val.start) {
      if (!globalStore.selected_items_id.includes(f.props.bind_anchors.val.start.id)) {
        f.props.bind_anchors.val.start = null;
      }
    }
    if (f.props.bind_anchors.val.end) {
      if (!globalStore.selected_items_id.includes(f.props.bind_anchors.val.end.id)) {
        f.props.bind_anchors.val.end = null;
      }
    }
  });
  //移动的时候要判断一下有没有系统连线绑定到了该组件
  const all_bind_sys_line = globalStore.done_json.filter(
    (f) =>
      f.type == 'sys-line' &&
      (globalStore.selected_items_id.includes(f.props.bind_anchors.val.start?.id) ||
        globalStore.selected_items_id.includes(f.props.bind_anchors.val.end?.id)) &&
      !globalStore.selected_items_id.includes(f.id)
  );
  useUpdateSysLine(
    all_bind_sys_line,
    globalStore.done_json,
    canvasAreaRef.value,
    globalStore.canvasCfg.scale,
    move_binfo
  );
};
/**
 * 移动完成事件
 */
const onMoveMouseUp = () => {
  //移动完毕之后隐藏参考线
  globalStore.guideCfg.x.display = false;
  globalStore.guideCfg.y.display = false;
  cacheStore.addHistory(globalStore.done_json);
};
/**
 * 缓存连线可以吸附的四个点
 * @param item
 */
const cacheAdsorbPoint = (item: IDoneJson) => {
  // 四个角原始坐标
  const { topLeft, topRight, bottomLeft, bottomRight } = getRectCoordinate(item.binfo);
  // 四条边中点坐标
  const { topCenter, bottomCenter, leftCenter, rightCenter } = getRectCenterCoordinate(
    topLeft,
    topRight,
    bottomLeft,
    bottomRight
  );
  // 旋转中心
  const centerX = topCenter.x;
  const centerY = leftCenter.y;

  // 旋转角度（弧度）
  const angleRad = (Math.PI / 180) * item.binfo.angle;

  // 计算旋转后的坐标
  const rotatedTopCenter = rotatePoint(topCenter.x, topCenter.y, centerX, centerY, angleRad);
  const rotatedBottomCenter = rotatePoint(
    bottomCenter.x,
    bottomCenter.y,
    centerX,
    centerY,
    angleRad
  );
  const rotatedLeftCenter = rotatePoint(leftCenter.x, leftCenter.y, centerX, centerY, angleRad);
  const rotatedRightCenter = rotatePoint(rightCenter.x, rightCenter.y, centerX, centerY, angleRad);
  cacheStore.setAdsorbPoint([
    {
      type: 'tc',
      x: rotatedTopCenter.x,
      y: rotatedTopCenter.y,
      id: item.id
    },
    {
      type: 'bc',
      x: rotatedBottomCenter.x,
      y: rotatedBottomCenter.y,
      id: item.id
    },
    {
      type: 'lc',
      x: rotatedLeftCenter.x,
      y: rotatedLeftCenter.y,
      id: item.id
    },
    {
      type: 'rc',
      x: rotatedRightCenter.x,
      y: rotatedRightCenter.y,
      id: item.id
    }
  ]);
};
const onItemMouseEnter = (e: any, item: IDoneJson) => {
  // 鼠标进入的时候计算可以吸附的四点坐标 去除连线
  if (item.type == 'sys-line') {
    return;
  }
  cacheAdsorbPoint(item);
};
const onItemMouseLeave = (e: any, item: IDoneJson) => {
  //如果拖动连线起点或者终点，则不清空连线锚点缓存
  if (globalStore.intention == 'adsorbStart' || globalStore.intention == 'adsorbEnd') {
    return;
  }
  cacheStore.setAdsorbPoint([]);
};
const setIntention = (val: GlobalStoreIntention) => {
  globalStore.setIntention(val);
};
const onAdsorbPointMouseEnter = (item: {
  type: AdsorbPointType;
  x: number;
  y: number;
  id: string;
}) => {
  if (globalStore.intention == 'adsorbStart' || globalStore.intention == 'adsorbEnd') {
    //将当前操作的连线绑定到该锚点上
    const handle_item = globalStore.done_json.find((f) => f.id == globalStore.selected_items_id[0]);
    if (handle_item) {
      if (globalStore.intention == 'adsorbStart') {
        handle_item.props.bind_anchors.val = {
          ...handle_item.props.bind_anchors.val,
          start: {
            type: item.type,
            id: item.id
          }
        };
        handle_item.props.point_position.val[0] = {
          x: item.x - handle_item.binfo.left,
          y: item.y - handle_item.binfo.top
        };
      } else if (globalStore.intention == 'adsorbEnd') {
        handle_item.props.bind_anchors.val = {
          ...handle_item.props.bind_anchors.val,
          end: {
            type: item.type,
            id: item.id
          }
        };
        handle_item.props.point_position.val[handle_item.props.point_position.val.length - 1] = {
          x: item.x - handle_item.binfo.left,
          y: item.y - handle_item.binfo.top
        };
      }
    }
  }
};
const onAdsorbPointMouseOut = () => {
  if (globalStore.intention == 'adsorbStart' || globalStore.intention == 'adsorbEnd') {
    //将当前操作的连线取消绑定到该锚点上
    const handle_item = globalStore.done_json.find((f) => f.id == globalStore.selected_items_id[0]);
    if (handle_item) {
      if (globalStore.intention == 'adsorbStart') {
        handle_item.props.bind_anchors.val = {
          ...handle_item.props.bind_anchors.val,
          start: null
        };
      } else if (globalStore.intention == 'adsorbEnd') {
        handle_item.props.bind_anchors.val = {
          ...handle_item.props.bind_anchors.val,
          end: null
        };
      }
    }
  }
};
const onItemResizeDone = (item: IDoneJson) => {
  // 缩放完成之后查看是否有连线绑定到了该图形 更新连线信息
  const update_lines = globalStore.done_json.filter(
    (f) =>
      f.type == 'sys-line' &&
      (f.props.bind_anchors.val.start?.id == item.id || f.props.bind_anchors.val.end?.id == item.id)
  );
  useUpdateSysLine(
    update_lines,
    globalStore.done_json,
    canvasAreaRef.value,
    globalStore.canvasCfg.scale
  );
  cacheStore.addHistory(globalStore.done_json);
};
const onItemRotateDone = (item: IDoneJson) => {
  const update_lines = globalStore.done_json.filter(
    (f) =>
      f.type == 'sys-line' &&
      (f.props.bind_anchors.val.start?.id == item.id || f.props.bind_anchors.val.end?.id == item.id)
  );
  useUpdateSysLine(
    update_lines,
    globalStore.done_json,
    canvasAreaRef.value,
    globalStore.canvasCfg.scale
  );
  cacheStore.addHistory(globalStore.done_json);
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
  // 取出当前选中的所有元素
  const selected_items = globalStore.done_json.filter((f) =>
    globalStore.selected_items_id.includes(f.id)
  );
  handleAlign(
    type,
    selected_items,
    canvasAreaRef.value,
    globalStore.canvasCfg.scale,
    globalStore.done_json
  );
  cacheStore.addHistory(globalStore.done_json);
};
const dragCanvasMouseDown = () => {
  init_drag_offset.x = globalStore.canvasCfg.drag_offset.x;
  init_drag_offset.y = globalStore.canvasCfg.drag_offset.y;
};
const startCanvasDrag = (e: MouseEvent | TouchEvent) => {
  e.preventDefault();
  globalStore.setIntention('beginDragCanvas');
  dragCanvasRef.value?.onMouseDown(e);
};
/**
 * 画布拖动移动事件
 * @param move_x
 * @param move_y
 */
const dragCanvasMouseMove = (move_x: number, move_y: number) => {
  if (move_x === 0 && move_y === 0) {
    return;
  }
  // 右键菜单显示中，不响应画布拖动
  if (globalStore.intention == 'showContextMenu') {
    return;
  }
  globalStore.setIntention('runDragCanvas');
  // 设置画布偏移
  globalStore.canvasCfg.drag_offset = {
    x: init_drag_offset.x + move_x,
    y: init_drag_offset.y + move_y
  };
};
/**
 * 画布拖动结束事件
 */
const dragCanvasMouseUp = () => {
  if (globalStore.intention == 'runDragCanvas') {
    globalStore.setIntention('endDragCanvas');
  } else if (globalStore.intention == 'showContextMenu') {
    // 右键菜单显示中，不重置状态，保持菜单可见
    return;
  } else {
    globalStore.setIntention('none');
  }
};
/**
 * 画布点击事件
 * @param e
 */
const onCanvasRightClick = (e: MouseEvent) => {
  if (globalStore.intention == 'endDragCanvas') {
    return;
  }
  const show_item: ContextMenuInfoType[] = [];
  if (cacheStore.copy.length > 0) {
    show_item.push('paste');
  }
  if (globalStore.done_json.length > 0) {
    show_item.push('selectAll');
  }
  contextMenuStore.setDisplayItem(show_item);
  contextMenuStore.setMenuInfo({
    ...contextMenuStore.menuInfo,
    ...{
      left: e.clientX,
      top: e.clientY
    }
  });
  globalStore.setIntention('showContextMenu');
};
const onItemRightClick = (e: MouseEvent, item: IDoneJson) => {
  const show_item: ContextMenuInfoType[] = ['copy', 'delete'];
  if (mainPanelProps.groupEnabled) {
    show_item.push('group');
  }
  if (mainPanelProps.unGroupEnabled) {
    show_item.push('ungroup');
  }
  if (mainPanelProps.deleteEnabled) {
    show_item.push('delete');
  }
  const find_item_index = globalStore.done_json.findIndex((f) => f.id == item.id);
  if (find_item_index > -1 && find_item_index < globalStore.done_json.length - 1) {
    show_item.push('moveTop');
    show_item.push('moveUp');
  }
  if (find_item_index > -1 && find_item_index > 0) {
    show_item.push('moveDown');
    show_item.push('moveBottom');
  }
  contextMenuStore.setDisplayItem(show_item);
  contextMenuStore.setMenuInfo({
    ...contextMenuStore.menuInfo,
    ...{
      left: e.clientX,
      top: e.clientY
    }
  });
  globalStore.setIntention('showContextMenu');
};
/**
 * 全选
 */
const onContextMenuSelectAll = () => {
  globalStore.setSelectItems(globalStore.done_json.map((f) => f.id));
};
/**
 * 复制
 */
const onContextMenuCopy = () => {
  if (globalStore.selected_items_id.length < 1) {
    return;
  }
  cacheStore.setCopy(
    globalStore.done_json.filter((f) => globalStore.selected_items_id.includes(f.id))
  );
  ElMessage.success('复制成功');
};
const handlePasteData = (data: IDoneJson[]) => {
  data.forEach((f) => {
    f.id = f.tag + '-' + randomString();
    if (f.type == 'sys-line') {
      f.props.bind_anchors.val = {
        start: null,
        end: null
      };
    } else if (f.type == 'group' && f.children) {
      f.children = handlePasteData(f.children);
    }
  });
  return data;
};
/**
 *
 * 粘贴
 */
const onContextMenuPaste = (offset_x: number, offset_y: number) => {
  if (cacheStore.copy.length < 1) {
    return;
  }
  // 前置校验：未添加场站时禁止在画布上粘贴图形
  if (!ensureStationForDrawing()) {
    return;
  }
  const new_items = handlePasteData(objectDeepClone(cacheStore.copy)).map((m) => {
    return {
      ...m,
      binfo: {
        ...m.binfo,
        left: m.binfo.left - offset_x,
        top: m.binfo.top - offset_y
      }
    };
  });
  globalStore.setGlobalStoreDoneJson([...globalStore.done_json, ...new_items]);
  globalStore.setSelectItems(new_items.map((m) => m.id));
  cacheStore.addHistory(globalStore.done_json);
};
/**
 * 删除
 */
const onContextMenuDelete = () => {
  if (globalStore.selected_items_id.length < 1) {
    return;
  }
  globalStore.deleteSelectedItems();
  cacheStore.addHistory(globalStore.done_json);
};
/**
 * 组合
 */
const onContextMenuGroup = () => {
  if (globalStore.selected_items_id.length < 2) {
    return;
  }
  createGroupItem();
};
/**
 * 取消组合
 */
const onContextMenuUnGroup = () => {
  if (globalStore.selected_items_id.length > 1) {
    return;
  }
  onUngroup();
};
const onContextMoveTop = () => {
  if (globalStore.selected_items_id.length !== 1) {
    return;
  }
  const item = globalStore.done_json.find((f) => f.id === globalStore.selected_items_id[0])!;
  globalStore.setGlobalStoreDoneJson([
    ...globalStore.done_json.filter((f) => f.id !== item.id),
    item
  ]);
  cacheStore.addHistory(globalStore.done_json);
};
const onContextMoveBottom = () => {
  if (globalStore.selected_items_id.length !== 1) {
    return;
  }
  const item = globalStore.done_json.find((f) => f.id === globalStore.selected_items_id[0])!;
  globalStore.setGlobalStoreDoneJson([
    item,
    ...globalStore.done_json.filter((f) => f.id !== item.id)
  ]);
  cacheStore.addHistory(globalStore.done_json);
};
const onContextMoveUp = () => {
  if (globalStore.selected_items_id.length !== 1) {
    return;
  }
  // 找到当前选中item的index
  const index = globalStore.done_json.findIndex((f) => f.id === globalStore.selected_items_id[0]);
  if (index >= globalStore.done_json.length - 1) {
    ElMessage.error('已经是最上层了');
    return;
  }
  const temp = globalStore.done_json[index];
  globalStore.done_json[index] = globalStore.done_json[index + 1];
  globalStore.done_json[index + 1] = temp;
  globalStore.setGlobalStoreDoneJson(globalStore.done_json);
  cacheStore.addHistory(globalStore.done_json);
};
const onContextMoveDown = () => {
  if (globalStore.selected_items_id.length !== 1) {
    return;
  }

  // 找到当前选中item的index
  const index = globalStore.done_json.findIndex((f) => f.id === globalStore.selected_items_id[0]);
  if (index <= 0) {
    ElMessage.error('已经是最下层了');
    return;
  }
  const temp = globalStore.done_json[index];
  globalStore.done_json[index] = globalStore.done_json[index - 1];
  globalStore.done_json[index - 1] = temp;
  globalStore.setGlobalStoreDoneJson(globalStore.done_json);
  cacheStore.addHistory(globalStore.done_json);
};
const onUndo = () => {
  if (cacheStore.historyIndex == 0) {
    return;
  }
  cacheStore.historyIndex -= 1;
  globalStore.setGlobalStoreDoneJson(objectDeepClone(cacheStore.history[cacheStore.historyIndex]));
  globalStore.setSelectItems([]);
};
const onRedo = () => {
  if (cacheStore.historyIndex == cacheStore.history.length - 1) {
    return;
  }
  cacheStore.historyIndex += 1;
  globalStore.setGlobalStoreDoneJson(objectDeepClone(cacheStore.history[cacheStore.historyIndex]));
  globalStore.setSelectItems([]);
};
/**
 * 右键菜单点击事件
 * @param key
 * @param e
 */
const onContextMenuClick = (key: ContextMenuInfoType, e: MouseEvent) => {
  switch (key) {
    case 'selectAll':
      onContextMenuSelectAll();
      break;
    case 'copy':
      onContextMenuCopy();
      break;
    case 'paste': {
      if (cacheStore.copy.length < 1) {
        return;
      }
      const { x, y } = getCanvasXY(
        e,
        canvasAreaRef.value?.getBoundingClientRect(),
        globalStore.canvasCfg.scale,
        globalStore.canvasCfg.transform_origin
      );
      const left = alignToGrid(x, 1);
      const top = alignToGrid(y, 1);
      // 找到top最小的那条数据的id
      let min_top_id = '';
      let min_top = Infinity;
      cacheStore.copy.forEach((f) => {
        if (f.binfo.top < min_top) {
          min_top = f.binfo.top;
          min_top_id = f.id;
        }
      });

      const min_top_item = cacheStore.copy.find((f) => f.id === min_top_id);

      const offset_x = min_top_item!.binfo.left - left;
      const offset_y = min_top_item!.binfo.top - top;
      onContextMenuPaste(offset_x, offset_y);
      break;
    }
    case 'delete':
      onContextMenuDelete();
      break;
    case 'group':
      onContextMenuGroup();
      break;
    case 'ungroup':
      onContextMenuUnGroup();
      break;
    case 'moveTop': {
      onContextMoveTop();
      break;
    }
    case 'moveBottom': {
      onContextMoveBottom();
      break;
    }
    case 'moveUp': {
      onContextMoveUp();
      break;
    }
    case 'moveDown': {
      onContextMoveDown();
      break;
    }
    default:
      break;
  }
  globalStore.setIntention('none');
};
const isEditableShortcutTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.isContentEditable ||
      target.closest(
        'input, textarea, select, [contenteditable="true"], .ace_editor, .monaco-editor'
      )
  );
};
const isSpaceDragShortcut = (e: KeyboardEvent) => {
  return (
    (e.code === 'Space' || e.key === ' ') &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !isEditableShortcutTarget(e.target)
  );
};
const resetSpaceDragShortcut = () => {
  is_space_pressed.value = false;
  if (globalStore.intention === 'beginDragCanvas' || globalStore.intention === 'endDragCanvas') {
    globalStore.setIntention('none');
  }
};
const FAST_NUDGE_MULTIPLIER = 10;
const getNudgeStep = (e: KeyboardEvent) => {
  const distance = normalizeKeyboardMoveDistance(globalStore.canvasCfg.keyboard_move_distance);

  return e.shiftKey ? distance * FAST_NUDGE_MULTIPLIER : distance;
};
const onKeydown = (e: KeyboardEvent) => {
  if (isSpaceDragShortcut(e)) {
    e.preventDefault();
    if (!is_space_pressed.value) {
      is_space_pressed.value = true;
      if (globalStore.intention === 'none' || globalStore.intention === 'endDragCanvas') {
        globalStore.setIntention('beginDragCanvas');
      }
    }
    return;
  }

  // 全选
  if (e.ctrlKey && e.key.toLocaleLowerCase() === 'a') {
    e.preventDefault();
    onContextMenuSelectAll();
  }
  //复制
  else if (e.ctrlKey && e.key.toLocaleLowerCase() === 'c') {
    e.preventDefault();
    onContextMenuCopy();
  }
  //粘贴
  else if (e.ctrlKey && e.key.toLocaleLowerCase() === 'v') {
    e.preventDefault();
    onContextMenuPaste(10, 10);
  }
  //删除
  else if (e.key.toLocaleLowerCase() === 'delete') {
    e.preventDefault();
    onContextMenuDelete();
  }
  //组合
  else if (e.ctrlKey && e.key.toLocaleLowerCase() === 'g') {
    e.preventDefault();
    onContextMenuGroup();
  }
  //取消组合
  else if (e.ctrlKey && e.key.toLocaleLowerCase() === 'u') {
    e.preventDefault();
    onContextMenuUnGroup();
  }
  // 置顶
  else if (e.ctrlKey && e.key === 'ArrowRight') {
    e.preventDefault();
    onContextMoveTop();
  }
  // 置底
  else if (e.ctrlKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    onContextMoveBottom();
  }
  // 上移一层
  else if (e.ctrlKey && e.key === 'ArrowUp') {
    e.preventDefault();
    onContextMoveUp();
  }
  // 下移一层
  else if (e.ctrlKey && e.key === 'ArrowDown') {
    e.preventDefault();
    onContextMoveDown();
  }
  // 撤销
  else if (e.ctrlKey && e.key.toLocaleLowerCase() === 'z') {
    e.preventDefault();
    onUndo();
  }
  // 重做
  else if (e.ctrlKey && e.key.toLocaleLowerCase() === 'y') {
    e.preventDefault();
    onRedo();
  }

  // 方向键按页面配置移动，Shift + 方向键按配置值的 10 倍快速移动
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    upDateLeftAndTop(0, -getNudgeStep(e));
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    upDateLeftAndTop(0, getNudgeStep(e));
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    upDateLeftAndTop(-getNudgeStep(e), 0);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    upDateLeftAndTop(getNudgeStep(e), 0);
  }
  function upDateLeftAndTop(left: number, top: number) {
    if (globalStore.selected_items_id.length < 1) {
      return;
    }
    const update_lines: IDoneJson[] = [];
    globalStore.done_json.forEach((f) => {
      if (globalStore.selected_items_id.includes(f.id)) {
        f.binfo.left += left;
        f.binfo.top += top;
        if (f.type == 'sys-line') {
          f.props.bind_anchors.val = {
            start: null,
            end: null
          };
        } else {
          update_lines.push(
            ...globalStore.done_json.filter(
              (df) =>
                df.type == 'sys-line' &&
                (df.props.bind_anchors.val.start?.id == f.id ||
                  df.props.bind_anchors.val.end?.id == f.id)
            )
          );
        }
      }
    });
    useUpdateSysLine(
      update_lines,
      globalStore.done_json,
      canvasAreaRef.value,
      globalStore.canvasCfg.scale
    );
    cacheStore.addHistory(globalStore.done_json);
  }
};
const onKeyup = (e: KeyboardEvent) => {
  if (!isSpaceDragShortcut(e)) {
    return;
  }
  e.preventDefault();
  resetSpaceDragShortcut();
};
const onMouseWheel = (e: any) => {
  if (e.ctrlKey) {
    e.preventDefault();
    e.stopPropagation();
    const old_scale = globalStore.canvasCfg.scale;
    if (!Number.isFinite(old_scale) || old_scale <= 0) {
      globalStore.canvasCfg.scale = 1;
    }
    if (e.deltaY > 0) {
      globalStore.canvasCfg.scale = Math.max(0.1, (globalStore.canvasCfg.scale * 10 - 1) / 10);
    } else if (e.deltaY < 0) {
      globalStore.canvasCfg.scale = Math.min(5, (globalStore.canvasCfg.scale * 10 + 1) / 10);
    }
    if (old_scale === globalStore.canvasCfg.scale) {
      return;
    }

    const origin = globalStore.canvasCfg.transform_origin;
    const mouseCanvasX =
      origin.x + (e.clientX - globalStore.canvasCfg.drag_offset.x - origin.x) / old_scale;
    const mouseCanvasY =
      origin.y + (e.clientY - globalStore.canvasCfg.drag_offset.y - origin.y) / old_scale;

    globalStore.canvasCfg.drag_offset = {
      x: e.clientX - origin.x - (mouseCanvasX - origin.x) * globalStore.canvasCfg.scale,
      y: e.clientY - origin.y - (mouseCanvasY - origin.y) * globalStore.canvasCfg.scale
    };
  }
};
const beginListenerKeyDown = () => {
  if (is_listen_keydown) {
    return;
  }
  // 监听键盘事件
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('keyup', onKeyup);
  is_listen_keydown = true;
};
const stopListenerKeyDown = () => {
  if (!is_listen_keydown) {
    return;
  }
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('keyup', onKeyup);
  resetSpaceDragShortcut();
  is_listen_keydown = false;
};
const resetCanvasView = () => {
  resetSpaceDragShortcut();
  if (globalStore.intention === 'runDragCanvas') {
    globalStore.setIntention('none');
  }
  // 如果有保存的初始画布配置快照（导入/初始加载时），直接恢复到该状态
  if (globalStore.initialCanvasCfg) {
    const initial = globalStore.initialCanvasCfg;
    globalStore.canvasCfg.scale = initial.scale;
    globalStore.canvasCfg.transform_origin = {
      x: initial.transform_origin.x,
      y: initial.transform_origin.y
    };
    globalStore.canvasCfg.drag_offset = {
      x: initial.drag_offset.x,
      y: initial.drag_offset.y
    };
    return;
  }
  // 没有初始快照时，退化为重置到默认状态
  globalStore.canvasCfg.scale = 1;
  globalStore.canvasCfg.transform_origin = { x: 0, y: 0 };
  globalStore.canvasCfg.drag_offset = { x: 0, y: 0 };
};

/**
 * 定位并跳转至指定图元：选中该图元，并将画布视图平移到使其居中显示。
 * 复用画布既有的 transform_origin + scale + drag_offset 变换模型：
 * 屏幕上某画布点 p 的位置 = drag_offset + transform_origin + (p - transform_origin) * scale
 * 因此令目标图元中心 pc 落到视口中心 V，反解出 drag_offset 即可。
 */
const locateItem = (id: string) => {
  const item = globalStore.done_json.find((f) => f.id === id);
  const container = canvasAreaRef.value;

  if (!item || !container) {
    return;
  }

  globalStore.setSingleSelect(id);

  const { scale, transform_origin, drag_offset } = globalStore.canvasCfg;
  const pc = {
    x: item.binfo.left + item.binfo.width / 2,
    y: item.binfo.top + item.binfo.height / 2
  };
  const v = {
    x: container.clientWidth / 2,
    y: container.clientHeight / 2
  };

  globalStore.canvasCfg.drag_offset = {
    x: v.x - transform_origin.x - (pc.x - transform_origin.x) * scale,
    y: v.y - transform_origin.y - (pc.y - transform_origin.y) * scale
  };
  // 保持原有 intention，避免误触发布局/拖拽状态
  void drag_offset;
};
const onCanvasMove = () => {};
/**
 * 绘制线结束事件
 * @param line_item 绘制好的线
 */
const onDrawLineEnd = (line_item?: IDoneJson | null) => {
  if (!line_item) {
    globalStore.setIntention('none');
    return;
  }
  const done_json_temp = [...globalStore.done_json];
  const new_line_item = { ...line_item, id: line_item.tag + '-' + randomString() };
  done_json_temp.push(new_line_item);
  globalStore.setGlobalStoreDoneJson(done_json_temp);
  globalStore.setSingleSelect(new_line_item.id);
  globalStore.setIntention('none');
  cacheStore.addHistory(done_json_temp);
};
onMounted(() => {
  beginListenerKeyDown();
  window.addEventListener('blur', resetSpaceDragShortcut);
});
onUnmounted(() => {
  stopListenerKeyDown();
  window.removeEventListener('blur', resetSpaceDragShortcut);
});
defineExpose({
  createGroupItem,
  onUngroup,
  onAlignSelected,
  onRedo,
  onUndo,
  resetCanvasView,
  locateItem,
  beginListenerKeyDown,
  stopListenerKeyDown
});
</script>
<style scoped>
.canvasArea {
  position: relative;
  overflow: hidden;
  width: v-bind('globalStore.canvasCfg.width + "px"');
  height: v-bind('globalStore.canvasCfg.height + "px"');
  transform: v-bind('`scale(${globalStore.canvasCfg.scale})`');
  transform-origin: v-bind(
    '`${globalStore.canvasCfg.transform_origin.x}px ${globalStore.canvasCfg.transform_origin.y}px`'
  );
  background-color: v-bind('globalStore.canvasCfg.color');
  background-image: v-bind('"url("+globalStore.canvasCfg.img+")"');
  left: v-bind('globalStore.canvasCfg.drag_offset.x + "px"');
  top: v-bind('globalStore.canvasCfg.drag_offset.y + "px"');
}

.canvasContent {
  position: relative;
  width: 100%;
  height: 100%;
}

#guide-x {
  display: v-bind('globalStore.guideCfg.x.display?"block":"none"');
  position: absolute;
  width: 100%;
  left: 0px;
  top: v-bind('globalStore.guideCfg.x.top+"px"');
  border-top: 1px dashed #59c7f9;
}

#guide-y {
  display: v-bind('globalStore.guideCfg.y.display?"block":"none"');
  position: absolute;
  height: 100%;
  left: v-bind('globalStore.guideCfg.y.left+"px"');
  top: 0px;
  border-left: 1px dashed #59c7f9;
}
.adsorb-point {
  position: absolute;
  background: #fff;
  border: 1px solid #59c7f9;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  margin-top: -4px;
  border-radius: 50%;
  z-index: 1;
}
.adsorb-point:hover {
  background: #59c7f9;
}
</style>
