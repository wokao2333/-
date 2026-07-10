<template>
  <!-- 母线容器：左侧文字标签 + 右侧 SVG 水平线，flex 布局自动随标签宽度留出间距 -->
  <div class="busbar-wrapper">
    <span
      class="busbar-label"
      :style="{
        color: labelColor,
        fontSize: fontSize + 'px',
        marginRight: labelGap + 'px'
      }"
    >
      {{ label }}
    </span>
    <svg
      class="busbar-line"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line
        x1="0"
        y1="50%"
        x2="100%"
        y2="50%"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        stroke-linecap="butt"
      />
    </svg>
  </div>
</template>
<script setup lang="ts">
// 母线图元：水平直线 + 左侧文字标签
// 使用 flex 布局让标签宽度自动决定与线条的间距，避免文字和线条重合
const props = defineProps({
  // 线条颜色
  stroke: {
    type: String,
    default: '#E74C3C'
  },
  // 线条粗细（像素）
  strokeWidth: {
    type: Number,
    default: 4
  },
  // 左侧标签文字
  label: {
    type: String,
    default: '10KV'
  },
  // 标签文字颜色
  labelColor: {
    type: String,
    default: '#FFFFFF'
  },
  // 标签文字大小
  fontSize: {
    type: Number,
    default: 20
  },
  // 标签与线条之间的间距（像素）
  labelGap: {
    type: Number,
    default: 12
  }
});
</script>
<style scoped>
.busbar-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.busbar-label {
  font-family: sans-serif;
  font-weight: bold;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1;
}
.busbar-line {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
}
</style>
