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
  color: ''
});

const computedLabelFontSize = computed(() => props.labelFontSize || props.fontSize);
const computedLabelColor = computed(() => props.labelColor || props.color);
const computedValueFontSize = computed(() => props.valueFontSize || props.fontSize);
const computedValueColor = computed(() => props.valueColor || props.color);
const computedUnitText = computed(() => props.unit || '单位');
const computedUnitFontSize = computed(() => props.unitFontSize || props.fontSize);
const computedUnitColor = computed(() => props.unitColor || props.color);
</script>

<template>
  <table class="w-1/1 h-1/1 kvTable">
    <tbody>
      <tr>
        <td class="kvKey kvKeyValue">{{ props.label }}</td>
        <td class="kvValue kvKeyValue">{{ props.value }}</td>
        <td class="kvUnit kvKeyValue">{{ computedUnitText }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.kvTable {
  font-family: v-bind('`${props.fontFamily}`');
  border-collapse: collapse;
}

.kvKeyValue {
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kvKey {
  font-size: v-bind('`${computedLabelFontSize}px`');
  color: v-bind('`${computedLabelColor}`');
  width: v-bind('`${props.labelWidth}px`');
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
