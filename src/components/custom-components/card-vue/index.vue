<!-- eslint-disable vue/html-indent -->
<template>
  <div class="w-1/1 h-1/1 flex justify-center items-center custom-card">
    <el-card
      class="w-95/100 h-95/100"
      :shadow="props.shadow as any"
      :style="{
        borderColor: props.borderColor,
        borderStyle: 'solid',
        background: props.backGroundColor,
        boxShadow: props.shadow === 'never' ? 'none' : `0 0 10px ${props.boxShadow}`
      }"
    ></el-card>
  </div>
</template>
<script setup lang="ts">
import { ElCard } from 'element-plus';
const props = defineProps({
  shadow: {
    type: String,
    default: 'always'
  },
  borderColor: {
    type: String,
    default: '#35c94a'
  },
  backGroundColor: {
    type: String,
    default: 'rgba(2, 28, 15, 0.34)'
  },
  boxShadow: {
    type: String,
    default: 'rgba(53, 201, 74, 0.18)'
  }
});
</script>
<style lang="less">
.custom-card {
  .el-card.is-always-shadow {
    box-shadow: v-bind('`0 0 10px ${$props.boxShadow}`') !important;
  }
  .el-card.is-hover-shadow:hover {
    box-shadow: v-bind('`0 0 10px ${$props.boxShadow}`') !important;
  }
}
</style>
