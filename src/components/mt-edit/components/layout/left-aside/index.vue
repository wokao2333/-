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
            <div class="flex justify-end gap-8px pb-10px">
              <el-button
                v-if="is_selected_custom_category"
                type="danger"
                plain
                size="small"
                @click="onDeleteCustomCategory"
              >
                删除分类
              </el-button>
              <el-button type="primary" size="small" @click="upload_dialog_visible = true">
                上传图元
              </el-button>
            </div>
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
                <el-button
                  v-if="isCustomSymbol(item.id)"
                  class="absolute right-4px top-4px z-1"
                  type="danger"
                  link
                  size="small"
                  @click.stop="onDeleteCustomSymbol(item)"
                >
                  删除
                </el-button>
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
    <custom-symbol-upload-dialog
      v-model="upload_dialog_visible"
      :default-category="upload_default_category"
      :categories="upload_category_options"
      @submit="onCustomSymbolSubmit"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
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
  ElTree,
  ElMessage,
  ElMessageBox
} from 'element-plus';
import { useDark, useLocalStorage, useDebounce } from '@vueuse/core';
import { pinyin } from 'pinyin-pro';
import type {
  ILeftAsideConfig,
  ILeftAsideConfigItem,
  ILeftAsideConfigItemPublic
} from '@/components/mt-edit/store/types';
import { globalStore } from '@/components/mt-edit/store/global';
import CustomSymbolUploadDialog from './custom-symbol-upload-dialog.vue';
import {
  DEFAULT_CUSTOM_SYMBOL_CATEGORY,
  useCustomSymbols,
  type CustomSymbolDraft
} from '@/components/mt-edit/composables/use-custom-symbols';
import type { CustomSymbolRow } from '@/database';
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
const search_str = ref('');
// 输入防抖：输入停止 300ms 后才真正触发过滤，避免频繁触发搜索
const debounced_search = useDebounce(search_str, 300);
// 实际用于匹配的关键字（小写、去首尾空白）
const search_keyword = computed(() => (debounced_search.value ?? '').trim().toLowerCase());
// 拼音转换结果缓存，避免每次过滤重复计算
const pinyin_cache = new Map<string, { full: string; initials: string }>();
const toPinyin = (text: string) => {
  const cached = pinyin_cache.get(text);
  if (cached) return cached;
  const full = pinyin(text, { toneType: 'none', type: 'string' })
    .replace(/\s+/g, '')
    .toLowerCase();
  const initials = pinyin(text, { pattern: 'first', toneType: 'none', type: 'string' })
    .replace(/\s+/g, '')
    .toLowerCase();
  const result = { full, initials };
  pinyin_cache.set(text, result);
  return result;
};
// 单段文本匹配：标题/别名原文，以及其全拼、拼音首字母
const matchText = (text: string, keyword: string) => {
  if (!text) return false;
  if (text.toLowerCase().includes(keyword)) return true;
  const { full, initials } = toPinyin(text);
  return full.includes(keyword) || initials.includes(keyword);
};
// 物料匹配：标题 + 别名（别名支持逗号/分号/空格分隔的多个值）
const matchItem = (item: ILeftAsideConfigItemPublic, keyword: string) => {
  if (matchText(item.title, keyword)) return true;
  if (item.alias) {
    return item.alias
      .split(/[,;，；\s]+/)
      .filter(Boolean)
      .some((alias) => matchText(alias, keyword));
  }
  return false;
};
const manage_dialog_visiable = ref(false);
const upload_dialog_visible = ref(false);
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
const upload_default_category = computed(() =>
  selected_node_key.value && selected_node_key.value !== '系统组件'
    ? selected_node_key.value
    : DEFAULT_CUSTOM_SYMBOL_CATEGORY
);
const upload_category_options = computed(() =>
  classify_list.value.map((item) => item.label).filter((label) => label !== '系统组件')
);

const {
  symbols: custom_symbols,
  save: saveCustomSymbol,
  remove: removeCustomSymbol,
  removeCategory: removeCustomSymbolCategory
} = useCustomSymbols();
const custom_symbol_ids = computed(() => new Set(custom_symbols.value.map((symbol) => symbol.id)));
const isCustomSymbol = (itemId: string) => custom_symbol_ids.value.has(itemId);
const isCustomCategory = (category: string) => {
  const categorySymbolIds = new Set(
    custom_symbols.value.filter((symbol) => symbol.category === category).map((symbol) => symbol.id)
  );
  const categoryItems = leftAsideProps.leftAsideConfig.get(category) ?? [];
  return (
    categorySymbolIds.size > 0 &&
    categoryItems.length > 0 &&
    categoryItems.every((item) => categorySymbolIds.has(item.id))
  );
};
const is_selected_custom_category = computed(
  () => Boolean(selected_node_key.value) && isCustomCategory(selected_node_key.value)
);

// 自定义分类是异步从本地数据库注册的，需要同步到树和分类勾选状态。
watch(
  classify_list,
  (list) => {
    const available = new Set(list.map((item) => item.label));
    const disabled = new Set(disable_classify.value);
    checked_keys.value = checked_keys.value.filter((label) => available.has(label));
    active_names.value = active_names.value.filter((label) => available.has(label));
    disable_classify.value = disable_classify.value.filter((label) => available.has(label));
    for (const item of list) {
      if (!disabled.has(item.label) && !checked_keys.value.includes(item.label)) {
        checked_keys.value.push(item.label);
      }
      if (!disabled.has(item.label) && !active_names.value.includes(item.label)) {
        active_names.value.push(item.label);
      }
    }
    nextTick(() => treeRef.value?.setCheckedKeys(checked_keys.value));
  },
  { deep: true }
);
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
  const keyword = search_keyword.value;
  if (!keyword) {
    return arr;
  }
  return arr.filter((item) => matchItem(item, keyword));
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
const onCustomSymbolSubmit = async (draft: CustomSymbolDraft) => {
  const now = Date.now();
  const row: CustomSymbolRow = {
    id: draft.id,
    category: draft.category,
    title: draft.title,
    svg: draft.svg,
    props: draft.props,
    device: draft.device,
    attachLabel: draft.attachLabel,
    createTime: draft.createTime ?? now,
    updateTime: draft.updateTime ?? now
  };

  try {
    await saveCustomSymbol(row);
    selected_node_key.value = row.category;
    if (
      !checked_keys.value.includes(row.category) &&
      !disable_classify.value.includes(row.category)
    ) {
      checked_keys.value.push(row.category);
    }
    if (!active_names.value.includes(row.category)) active_names.value.push(row.category);
    await nextTick();
    treeRef.value?.setCheckedKeys(checked_keys.value);
    upload_dialog_visible.value = false;
    ElMessage.success(`图元“${row.title}”上传成功`);
  } catch (error) {
    console.error('保存自定义分类失败', error);
    ElMessage.error('图元保存失败，请重试');
  }
};
const clearCategoryUiState = (category: string) => {
  checked_keys.value = checked_keys.value.filter((label) => label !== category);
  active_names.value = active_names.value.filter((label) => label !== category);
  disable_classify.value = disable_classify.value.filter((label) => label !== category);
  if (selected_node_key.value === category) selected_node_key.value = undefined;
};
const isMessageBoxDismissed = (error: unknown) => error === 'cancel' || error === 'close';
const onDeleteCustomSymbol = async (item: ILeftAsideConfigItemPublic) => {
  const category = custom_symbols.value.find((symbol) => symbol.id === item.id)?.category;
  const removeEmptyCategory = Boolean(category && isCustomCategory(category));
  try {
    await ElMessageBox.confirm(
      `确定删除上传图元“${item.title}”吗？删除后，使用该图元的已保存图纸再次打开时可能无法还原该图元。`,
      '删除上传图元',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    );
    const removed = await removeCustomSymbol(item.id, { removeEmptyCategory });
    if (removed && !leftAsideProps.leftAsideConfig.has(removed.category)) {
      clearCategoryUiState(removed.category);
    }
    await nextTick();
    treeRef.value?.setCheckedKeys(checked_keys.value);
    ElMessage.success(`图元“${item.title}”已删除`);
  } catch (error) {
    if (isMessageBoxDismissed(error)) return;
    console.error('删除上传图元失败', error);
    ElMessage.error('图元删除失败，请重试');
  }
};
const onDeleteCustomCategory = async () => {
  const category = selected_node_key.value as string | undefined;
  if (!category || !isCustomCategory(category)) return;
  const symbolCount = custom_symbols.value.filter((symbol) => symbol.category === category).length;
  try {
    await ElMessageBox.confirm(
      `确定删除自定义分类“${category}”及其中的 ${symbolCount} 个上传图元吗？删除后，使用这些图元的已保存图纸再次打开时可能无法还原图元。`,
      '删除自定义分类',
      {
        type: 'warning',
        confirmButtonText: '删除分类',
        cancelButtonText: '取消'
      }
    );
    await removeCustomSymbolCategory(category);
    clearCategoryUiState(category);
    await nextTick();
    treeRef.value?.setCheckedKeys(checked_keys.value);
    ElMessage.success(`分类“${category}”已删除`);
  } catch (error) {
    if (isMessageBoxDismissed(error)) return;
    console.error('删除自定义分类失败', error);
    ElMessage.error('分类删除失败，请重试');
  }
};
const handleCheckChange = (data: { label: string }, checked: boolean) => {
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
