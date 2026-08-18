<template>
  <div class="w-1/1 h-1/1">
    <svg-render
      v-if="item_json.type === 'svg'"
      draggable="false"
      :symbol-id="item_json.symbol!.symbol_id"
      :symbol-str="item_json.symbol!.symbol_str"
      :width="item_json.symbol!.width"
      :height="item_json.symbol!.height"
      :props="item_json.props"
    ></svg-render>
    <group-render
      v-else-if="item_json.type === 'group'"
      :item-json="item_json"
      :grid="renderItemProps.grid"
      :canvas-cfg="renderItemProps.canvasCfg"
      :canvas-dom="renderItemProps.canvasDom"
      :editable="renderItemProps.editable"
      @update:item-json="onUpdateNestedItemJson"
    ></group-render>
    <component
      v-else-if="item_json.type === 'vue'"
      draggable="false"
      :is="item_json.tag"
      v-bind="prosToVBind(item_json.props)"
      :editable="item_json.tag === 'text-vue' ? renderItemProps.editable : undefined"
      @update:modelValue="(val: any) => onUpdateModelValue(item_json.props, val)"
      @update:text="onUpdateText"
    ></component>
    <img
      v-else-if="item_json.type === 'img'"
      draggable="false"
      class="w-1/1 h-1/1"
      :src="item_json.thumbnail"
    />
    <custom-svg-render v-else-if="item_json.type === 'custom-svg'">
      <component
        :is="item_json.tag"
        v-bind="prosToVBind(item_json.props)"
        :id="item_json.id"
      ></component>
    </custom-svg-render>
    <line-render
      v-else-if="item_json.type === 'sys-line'"
      v-model:item-json="item_json"
      :canvas-cfg="renderItemProps.canvasCfg"
      :grid="renderItemProps.grid"
      :canvas-dom="renderItemProps.canvasDom"
      :done-json="renderItemProps.doneJson"
      :lock-state="renderItemProps.lockState"
      :mode="renderItemProps.lineAppendEnable ? 'line-edit' : 'normal'"
      @set-intention="(val) => emits('setIntention', val)"
      @line-mouse-up="emits('lineMouseUp')"
    ></line-render>
  </div>
</template>
<script setup lang="ts">
import type {
  IDoneJson,
  IGlobalStoreCanvasCfg,
  IGlobalStoreGridCfg,
  ILeftAsideConfigItemPublicProps
} from '../../store/types';
import SvgRender from '@/components/mt-edit/components/svg-render/index.vue';
import GroupRender from '@/components/mt-edit/components/group-render/index.vue';
import { prosToVBind } from '@/components/mt-edit/utils';
import LineRender from '@/components/mt-edit/components/line-render/index.vue';
import CustomSvgRender from '@/components/mt-edit/components/custom-svg-render/index.vue';
import { computed } from 'vue';
type RenderItemProps = {
  itemJson: IDoneJson;
  canvasCfg: IGlobalStoreCanvasCfg;
  grid: IGlobalStoreGridCfg;
  canvasDom: HTMLElement | null;
  doneJson?: IDoneJson[];
  lockState: boolean;
  editable?: boolean;
  lineAppendEnable?: boolean;
};
const renderItemProps = withDefaults(defineProps<RenderItemProps>(), {
  doneJson: () => [],
  editable: true,
  lineAppendEnable: false
});
const emits = defineEmits(['update:itemJson', 'setIntention', 'lineMouseUp']);
const item_json = computed({
  get: () => renderItemProps.itemJson,
  set: (value) => {
    emits('update:itemJson', value);
  }
});
const onUpdateModelValue = (props: ILeftAsideConfigItemPublicProps, value: any) => {
  if (props.modelValue) {
    emits('update:itemJson', {
      ...item_json.value,
      props: {
        ...item_json.value.props,
        modelValue: {
          ...item_json.value.props.modelValue,
          val: value
        }
      }
    });
  }
};
const onUpdateText = (value: string) => {
  const textProp = item_json.value.props.text;
  if (!textProp) return;
  emits('update:itemJson', {
    ...item_json.value,
    props: {
      ...item_json.value.props,
      text: {
        ...textProp,
        val: value
      }
    }
  });
};
const onUpdateNestedItemJson = (value: IDoneJson) => {
  emits('update:itemJson', value);
};
</script>
<style scoped></style>
