<script setup lang="ts">
import { computed } from 'vue';

interface KvVueProps {
  fontFamily?: string;
  fontSize?: number;
  label?: string;
  labelWidth?: number;
  labelFontSize?: number;
  labelColor?: string;
  value?: string;
  valueWidth?: number;
  valueFontSize?: number;
  valueColor?: string;
  unit?: string;
  unitWidth?: number;
  unitGap?: number;
  unitFontSize?: number;
  unitColor?: string;
  paddingX?: number;
  paddingY?: number;
  color?: string;
  border?: boolean;
  borderColor?: string;
}

const props = withDefaults(defineProps<KvVueProps>(), {
  fontFamily: '',
  fontSize: 15,
  label: '',
  labelWidth: 50,
  labelFontSize: 0,
  labelColor: '',
  value: '',
  valueWidth: 50,
  valueFontSize: 0,
  valueColor: '',
  unit: '单位',
  unitWidth: 50,
  unitGap: 4,
  unitFontSize: 0,
  unitColor: '',
  paddingX: 10,
  paddingY: 6,
  color: ''
});

const computedLabelFontSize = computed(() => props.labelFontSize || props.fontSize);
const computedLabelColor = computed(() => props.labelColor || props.color);
const computedValueFontSize = computed(() => props.valueFontSize || props.fontSize);
const computedValueColor = computed(() => props.valueColor || props.color);
const computedUnitText = computed(() => props.unit || '单位');
const computedUnitFontSize = computed(() => props.unitFontSize || props.fontSize);
const computedUnitColor = computed(() => props.unitColor || props.color);
const computedUnitColumnWidth = computed(() => props.unitWidth + props.unitGap);
const computedTableWidth = computed(
  () => props.labelWidth + props.valueWidth + computedUnitColumnWidth.value
);
</script>

<template>
  <div class="w-1/1 h-1/1 kvWrap" :style="{ padding: `${props.paddingY}px ${props.paddingX}px` }">
    <table class="kvTable" :style="{ width: `${computedTableWidth}px` }">
      <colgroup>
        <col :style="{ width: `${props.labelWidth}px` }" />
        <col :style="{ width: `${props.valueWidth}px` }" />
        <col :style="{ width: `${computedUnitColumnWidth}px` }" />
      </colgroup>
      <tbody>
        <tr>
          <td class="kvKey kvKeyValue">{{ props.label }}</td>
          <td class="kvValue kvKeyValue">{{ props.value }}</td>
          <td class="kvUnit kvKeyValue">{{ computedUnitText }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* 外层容器：统一内边距，使内容距卡片边框保持安全距离，不改变三列内部相对间距 */
.kvWrap {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
}

/* 表格和 colgroup 都使用明确宽度，确保 fixed 布局不会因 value 内容长度回退为自动列宽。 */
.kvTable {
  table-layout: fixed;
  border-collapse: collapse;
  font-family: v-bind('`${props.fontFamily}`');
  white-space: nowrap;
}

.kvKeyValue {
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.kvKey {
  font-size: v-bind('`${computedLabelFontSize}px`');
  color: v-bind('`${computedLabelColor}`');
  width: v-bind('`${props.labelWidth}px`');
  padding-right: 0px;
}

.kvValue {
  font-size: v-bind('`${computedValueFontSize}px`');
  color: v-bind('`${computedValueColor}`');
  width: v-bind('`${props.valueWidth}px`');
  text-align: right;
}

.kvUnit {
  font-size: v-bind('`${computedUnitFontSize}px`');
  color: v-bind('`${computedUnitColor}`');
  width: v-bind('`${props.unitWidth}px`');
  padding-left: v-bind('`${props.unitGap}px`');
}
</style>
