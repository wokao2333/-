<template>
  <div id="mt-left-aside" class="pt-10px h-1/1 box-border p-x-6px">
    <el-input
      v-model="search_str"
      class="pb-10px pr-10px"
      placeholder="请输入关键字进行搜索"
    ></el-input>
    <div class="h-85/100">
      <el-scrollbar :view-style="{ height: '100%' }">
        <el-collapse v-model="active_names">
          <el-collapse-item
            v-for="config_item_key in checked_keys"
            :key="config_item_key"
            :title="config_item_key"
            :name="config_item_key"
          >
            <div class="flex flex-wrap">
              <div
                draggable="true"
                @dragstart="onDragStart(config_item_key, item.id)"
                @touchstart.passive="onDragStart(config_item_key, item.id)"
                class="w-60px h-66px flex flex-col items-center justify-start pt-6px gap-2px cursor-grab select-none rounded-1 hover:bg-gray-100"
                :class="isDark ? 'hover:bg-[#ffffff17]' : ''"
                v-for="(item, index) in getFilteritems(
                  leftAsideProps.leftAsideConfig.get(config_item_key)
                )"
                :key="item.id"
              >
                <el-tooltip
                  v-model:visible="is_show_tooltip[`${config_item_key}${item.id}`]"
                  placement="right"
                  :width="200"
                  :effect="isDark ? 'dark' : 'light'"
                  :show-arrow="false"
                  :hide-after="0"
                  trigger="hover"
                  :enterable="false"
                  :offset="getOffset(index + 1)"
                >
                  <el-image
                    draggable="false"
                    class="w-30px h-30px select-none"
                    :class="isDark ? 'bg-amber-50' : ''"
                    :src="item.thumbnail"
                  />
                  <template #content>
                    <div class="flex justify-center items-center">
                      <div class="flex flex-col">
                        <el-text>{{ item.title }}</el-text>
                        <el-image
                          class="w-100px h-100px pt-5px"
                          :class="isDark ? 'bg-amber-50' : ''"
                          :src="item.thumbnail"
                        />
                      </div>
                    </div>
                  </template>
                </el-tooltip>
                <span
                  class="w-full truncate text-center text-12px leading-tight text-gray-500 px-2px"
                  :title="item.title"
                  >{{ item.title }}</span
                >
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-scrollbar>
    </div>
    <div class="h-[calc(10%-1px)] flex justify-center items-center ct-border">
      <el-button class="w-80/100" @click="onManageClick">管理</el-button>
    </div>
    <el-dialog v-model="manage_dialog_visiable" title="图库管理" width="80%" destroy-on-close>
      <div class="flex">
        <div>
          <div>
            <div class="flex justify-center">
              <el-checkbox v-model="check_all" :indeterminate="is_indeterminate">全选</el-checkbox>
            </div>
            <el-scrollbar height="50vh">
              <el-tree
                ref="treeRef"
                :data="classify_list"
                :highlight-current="true"
                show-checkbox
                @check-change="handleCheckChange"
                node-key="label"
                :default-checked-keys="checked_keys"
                @node-click="onNodeClick"
              ></el-tree>
            </el-scrollbar>
          </div>
        </div>

        <el-divider direction="vertical" class="h-50vh ml-40px"></el-divider>
        <div v-if="selected_node_key">
          <el-scrollbar height="50vh">
            <div class="flex flex-wrap">
              <div
                v-for="item in leftAsideProps.leftAsideConfig.get(selected_node_key)"
                :key="item.id"
                class="w-160px h-160px flex flex-wrap justify-center items-center cursor-pointer relative"
              >
                <el-tooltip
                  :effect="isDark ? 'dark' : 'light'"
                  :content="item.title"
                  placement="top"
                >
                  <div>
                    <el-image
                      class="w-60px h-60px"
                      :class="isDark ? 'bg-amber-50' : ''"
                      :src="item.thumbnail"
                    />
                    <div class="w-60px h-60px flex justify-center items-center">
                      <el-text truncated>{{ item.title }}</el-text>
                    </div>
                  </div>
                </el-tooltip>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  ElInput,
  ElCollapse,
  ElCollapseItem,
  ElButton,
  ElScrollbar,
  ElImage,
  ElTooltip,
  ElText,
  ElDialog,
  ElCheckbox,
  ElDivider,
  ElTree
} from 'element-plus';
import SvgAnalysis from '@/components/mt-edit/components/svg-analysis/index.vue';
import { useDark, useLocalStorage } from '@vueuse/core';
import type {
  ILeftAsideConfig,
  ILeftAsideConfigItem,
  ILeftAsideConfigItemPublic
} from '@/components/mt-edit/store/types';
import { globalStore } from '@/components/mt-edit/store/global';
type LeftAsideProps = {
  leftAsideConfig: ILeftAsideConfig;
};
const leftAsideProps = withDefaults(defineProps<LeftAsideProps>(), {
  leftAsideConfig: () => new Map<string, ILeftAsideConfigItem[]>()
});
const isDark = useDark({
  selector: '#mt-edit'
});
// 从本地储存中查被禁用的类别
const disable_classify = useLocalStorage<string[]>('mt-disable-classify', []);
const treeRef = ref();
const is_show_tooltip: Record<string, boolean> = reactive({});
const active_names = ref<string[]>([]);
const search_str = ref();
const manage_dialog_visiable = ref(false);
const classify_list = computed(() =>
  [...leftAsideProps.leftAsideConfig.keys()].map((m) => {
    return { label: m };
  })
);
const checked_keys = ref<string[]>(
  classify_list.value.filter((f) => !disable_classify.value.includes(f.label)).map((m) => m.label)
);
// 默认展开全部分类
active_names.value = [...checked_keys.value];
const selected_node_key = ref();
const check_all = computed({
  get: () => {
    return classify_list.value.length == checked_keys.value.length;
  },
  set: (val) => {
    if (val) {
      checked_keys.value = classify_list.value.map((m) => m.label);
    } else {
      checked_keys.value = [];
      treeRef.value?.setCheckedNodes([]);
    }
  }
});
const is_indeterminate = computed(() => {
  return checked_keys.value.length > 0 && checked_keys.value.length < classify_list.value.length;
});
const getOffset = (index: number) => {
  return index % 4 == 0 ? 40 : index % 4 == 3 ? 80 : index % 4 == 2 ? 120 : 160;
};
const getFilteritems = (
  arr: ILeftAsideConfigItemPublic[] | undefined
): ILeftAsideConfigItemPublic[] => {
  if (!arr) {
    return [];
  }
  if (search_str.value) {
    return arr.filter((f) => f.title.includes(search_str.value));
  }
  return arr;
};
const onDragStart = (config_item_key: string, item_id: string) => {
  if (!config_item_key || !item_id) {
    console.error('拖拽初始化失败', config_item_key, item_id);
    return;
  }
  is_show_tooltip[`${config_item_key}${item_id}`] = false;
  globalStore.setIntention('create');
  globalStore.setCreateItemInfo({
    config_key: config_item_key,
    item_id
  });
};
const onManageClick = () => {
  manage_dialog_visiable.value = true;
};
const handleCheckChange = (data: { label: string }, checked: boolean, indeterminate: boolean) => {
  if (checked && !checked_keys.value.includes(data.label)) {
    checked_keys.value.push(data.label);
  } else if (!checked) {
    checked_keys.value = checked_keys.value.filter((f) => f !== data.label);
  }
  disable_classify.value = classify_list.value
    .filter((f) => !checked_keys.value.includes(f.label))
    .map((m) => m.label);
};
const onNodeClick = ({ label }: { label: string }) => {
  selected_node_key.value = label;
};
</script>
<style>
#mt-left-aside .el-collapse-item__header,
#mt-left-aside .el-collapse-item__wrap {
  background-color: transparent !important;
}
</style>
