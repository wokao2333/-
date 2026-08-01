<template>
  <svg
    :id="lineRenderProps.itemJson.id"
    class="mt-line-render"
    :style="{
      position: 'absolute',
      left: `${-offset}px`,
      top: `${-offset}px`,
      width: `${lineRenderProps.canvasCfg.width + offset}px`,
      height: `${lineRenderProps.canvasCfg.height + offset}px`
    }"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    pointer-events="none"
  >
    <g>
      <defs>
        <marker
          :id="'markerArrowStart' + lineRenderProps.itemJson.id"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" :fill="lineRenderProps.itemJson.props.stroke.val" />
        </marker>
        <marker
          :id="'markerArrowEnd' + lineRenderProps.itemJson.id"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" :fill="lineRenderProps.itemJson.props.stroke.val" />
        </marker>
      </defs>
      <path
        :d="
          positionArrarToPath(
            lineRenderProps.itemJson.props.point_position.val,
            lineRenderProps.itemJson.binfo.left + offset,
            lineRenderProps.itemJson.binfo.top + offset
          )
        "
        pointer-events="visibleStroke"
        fill="none"
        :stroke="
          lineRenderProps.itemJson.props.ani_type.val === 'electricity'
            ? lineRenderProps.itemJson.props.ani_color.val
            : lineRenderProps.itemJson.props.stroke.val
        "
        :stroke-width="lineRenderProps.itemJson.props['stroke-width'].val"
        style="cursor: move"
        stroke-dashoffset="0"
        :stroke-dasharray="
          lineRenderProps.itemJson.props.ani_type.val === 'electricity'
            ? lineRenderProps.itemJson.props['stroke-width'].val * 3
            : 0
        "
        :marker-start="
          lineRenderProps.itemJson.props?.['marker-start']?.val
            ? `url(#markerArrowStart${lineRenderProps.itemJson.id})`
            : ''
        "
        :marker-end="
          lineRenderProps.itemJson.props?.['marker-end']?.val
            ? `url(#markerArrowEnd${lineRenderProps.itemJson.id})`
            : ''
        "
        class="real"
      >
        <animate
          v-if="lineRenderProps.itemJson.props.ani_type.val === 'electricity'"
          attributeName="stroke-dashoffset"
          :from="lineRenderProps.itemJson.props.ani_reverse.val ? 0 : 1000"
          :to="
            lineRenderProps.itemJson.props.ani_reverse.val
              ? lineRenderProps.itemJson.props.ani_play.val
                ? 1000
                : 0
              : lineRenderProps.itemJson.props.ani_play.val
              ? 0
              : 1000
          "
          :dur="`${
            lineRenderProps.itemJson.props.ani_dur.val < 1
              ? 1
              : lineRenderProps.itemJson.props.ani_dur.val
          }s`"
          repeatCount="indefinite"
        />
      </path>
    </g>
  </svg>
</template>
<script setup lang="ts">
import type { MouseTouchEvent } from '@/components/mt-dzr/utils/types';
import type {
  DrawLineMode,
  IDoneJson,
  IGlobalStoreCanvasCfg,
  IGlobalStoreGridCfg
} from '../../store/types';
import {
  alignToGrid,
  getCanvasBinfoFromClientRect,
  positionArrarToPath
} from '@/components/mt-edit/utils';
import { computed } from 'vue';
import { configStore } from '../../store/config';
type LineRenderProps = {
  itemJson: IDoneJson;
  canvasCfg: IGlobalStoreCanvasCfg;
  grid: IGlobalStoreGridCfg;
  canvasDom: HTMLElement | null;
  mode: 'pen' | 'pencil';
  /** 连线绘制模式：free 自由绘制；vertical 始终垂直；horizontal 始终水平 */
  lineMode?: DrawLineMode;
};
const lineRenderProps = withDefaults(defineProps<LineRenderProps>(), {
  mode: 'pen',
  lineMode: 'free'
});
const lineRenderEmits = defineEmits(['drawLineEnd']);
const offset = configStore.lineRenderOffset;
//如果网格关闭或者没有开启网格对齐，网格大小为1
const grid_align_size = computed(() =>
  !lineRenderProps.grid.align || !lineRenderProps.grid.enabled ? 1 : lineRenderProps.grid.size
);
const onMouseDown = (de: MouseTouchEvent, point_index: number, item: { x: number; y: number }) => {
  de.stopPropagation();
  // 记录鼠标按下时实际点的坐标
  const { x: realityX, y: realityY } = item;
  // 记录最开始点击时鼠标位置
  const d_x = de instanceof MouseEvent ? de.clientX : de.touches[0].pageX;
  const d_y = de instanceof MouseEvent ? de.clientY : de.touches[0].pageY;
  let new_x = 0;
  let new_y = 0;
  let hasDragged = false;
  const onMouseMove = (e: MouseTouchEvent) => {
    // 记录鼠标移动的位置
    const m_x = e instanceof MouseEvent ? e.clientX : e.touches[0].pageX;
    const m_y = e instanceof MouseEvent ? e.clientY : e.touches[0].pageY;
    if (Math.abs(m_x - d_x) > 3 || Math.abs(m_y - d_y) > 3) {
      hasDragged = true;
    }
    // 移动的距离
    const move_x = de.ctrlKey ? 0 : alignToGrid((m_x - d_x) / lineRenderProps.canvasCfg.scale, 1); //感觉对齐网格有点体验不好 所以固定为一了
    const move_y = de.shiftKey ? 0 : alignToGrid((m_y - d_y) / lineRenderProps.canvasCfg.scale, 1);
    new_x = realityX + move_x;
    new_y = realityY + move_y;
    // 连线模式约束：竖线模式锁定 x 保持垂直，横线模式锁定 y 保持水平；free 不约束
    if (lineRenderProps.lineMode === 'vertical') {
      new_x = realityX;
    } else if (lineRenderProps.lineMode === 'horizontal') {
      new_y = realityY;
    }
    if (lineRenderProps.mode == 'pencil') {
      const new_point_position = lineRenderProps.itemJson.props.point_position.val;
      new_point_position.push({
        x: new_x,
        y: new_y
      });
      return;
    } else {
      const new_point_position = lineRenderProps.itemJson.props.point_position.val;
      new_point_position[point_index].x = new_x;
      new_point_position[point_index].y = new_y;
    }
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onMouseMove);
    document.removeEventListener('touchend', onMouseUp);

    const pos = lineRenderProps.itemJson.props.point_position.val;
    const isZeroLength =
      pos.length >= 2 && pos[0].x === pos[pos.length - 1].x && pos[0].y === pos[pos.length - 1].y;

    if (!hasDragged || isZeroLength) {
      lineRenderEmits('drawLineEnd', null);
      return;
    }

    const itemRect = document
      .querySelector(`#${lineRenderProps.itemJson.id} g .real`)!
      .getBoundingClientRect();
    const canvas_area_bounding_info = lineRenderProps.canvasDom!.getBoundingClientRect();
    const canvas_binfo = getCanvasBinfoFromClientRect(
      itemRect,
      canvas_area_bounding_info,
      lineRenderProps.canvasCfg.scale,
      lineRenderProps.canvasCfg.transform_origin
    );
    const new_left = canvas_binfo.left;
    const new_top = canvas_binfo.top;
    const move_x = new_left - lineRenderProps.itemJson.binfo.left;
    const move_y = new_top - lineRenderProps.itemJson.binfo.top;
    const new_item_json = {
      ...lineRenderProps.itemJson,
      binfo: {
        ...lineRenderProps.itemJson.binfo,
        left: new_left,
        top: new_top,
        width: canvas_binfo.width,
        height: canvas_binfo.height
      },
      props: {
        ...lineRenderProps.itemJson.props,
        point_position: {
          ...lineRenderProps.itemJson.props.point_position,
          val: lineRenderProps.itemJson.props.point_position.val.map(
            (m: { x: number; y: number }) => {
              return {
                x: m.x - move_x,
                y: m.y - move_y
              };
            }
          )
        }
      }
    };
    lineRenderEmits('drawLineEnd', new_item_json);
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
<style scoped></style>
