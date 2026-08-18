<template>
  <div class="mt-group">
    <div
      class="absolute"
      v-for="item in groupRender.itemJson.children"
      :key="item.id"
      :id="item.id"
      :style="{
        left: item.binfo.left + '%',
        top: item.binfo.top + '%',
        width: item.binfo.width + '%',
        height: item.binfo.height + '%',
        transform: `rotate(${item.binfo.angle}deg)`
      }"
    >
      <render-item
        :item-json="item"
        :grid="groupRender.grid"
        :canvas-cfg="groupRender.canvasCfg"
        :canvas-dom="groupRender.canvasDom"
        :lock-state="false"
        :editable="groupRender.editable && !item.lock"
        @update:item-json="(value) => onUpdateChild(item.id, value)"
      ></render-item>
    </div>
  </div>
</template>
<script setup lang="ts">
import RenderItem from '@/components/mt-edit/components/render-item/index.vue';
import type {
  IDoneJson,
  IGlobalStoreCanvasCfg,
  IGlobalStoreGridCfg
} from '@/components/mt-edit/store/types';
type GroupRender = {
  itemJson: IDoneJson;
  grid: IGlobalStoreGridCfg;
  canvasCfg: IGlobalStoreCanvasCfg;
  canvasDom: HTMLElement | null;
  editable?: boolean;
};
const groupRender = withDefaults(defineProps<GroupRender>(), {});
const emits = defineEmits(['update:itemJson']);

const onUpdateChild = (id: string, value: IDoneJson) => {
  emits('update:itemJson', {
    ...groupRender.itemJson,
    children: (groupRender.itemJson.children ?? []).map((item) => (item.id === id ? value : item))
  });
};
</script>
<style scoped>
.mt-group {
  left: v-bind('groupRender.itemJson.binfo.left+"px"');
  top: v-bind('groupRender.itemJson.binfo.top+"px"');
  width: v-bind('groupRender.itemJson.binfo.width+"px"');
  height: v-bind('groupRender.itemJson.binfo.height+"px"');
}
</style>
