<template>
  <div id="mt-template-aside" class="h-1/1 flex flex-col p-10px box-border">
    <div class="flex-1 min-h-0 overflow-hidden">
      <el-scrollbar :view-style="{ height: '100%' }">
        <el-empty v-if="!templates.length" description="暂无模版，点击下方新建模版" />
        <div v-else class="flex flex-col gap-10px pr-4px">
          <div
            v-for="tpl in templates"
            :key="tpl.id"
            class="relative group rounded border border-[var(--el-border-color)] bg-[var(--el-fill-color-light)] p-10px cursor-grab hover:border-blue-500 transition-all"
            draggable="true"
            @dragstart="onDragStart(tpl)"
            @dragend="onDragEnd"
          >
            <div class="flex items-center justify-between gap-8px pr-24px">
              <el-text truncated class="font-medium">{{ tpl.name }}</el-text>
              <span class="text-xs text-gray-400 shrink-0">{{ tpl.itemCount }} 项</span>
            </div>
            <el-text v-if="tpl.remark" size="small" type="info" truncated class="block mt-4px">{{
              tpl.remark
            }}</el-text>
            <div
              class="absolute right-6px top-6px opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <el-button type="danger" size="small" circle @click.stop="onDelete(tpl)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <div class="mt-6px text-xs text-gray-400">拖拽到画布即可复用</div>
          </div>
        </div>
      </el-scrollbar>
    </div>
    <div class="h-[calc(10%-1px)] flex items-center gap-8px ct-border">
      <el-button class="flex-1" type="primary" @click="emits('newTemplate')">新建模版</el-button>
      <el-button class="flex-1" @click="emits('saveCurrent')">保存当前画布</el-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  ElButton,
  ElScrollbar,
  ElEmpty,
  ElText,
  ElIcon,
  ElMessage,
  ElMessageBox
} from 'element-plus';
import { Delete } from '@element-plus/icons-vue';
import { globalStore } from '@/components/mt-edit/store/global';
import { objectDeepClone } from '@/components/mt-edit/utils';
import { useTemplateDB } from '@/composables/useTemplateDB';
import type { TemplateItem } from './types';

const emits = defineEmits<{
  newTemplate: [];
  saveCurrent: [];
}>();

const templates = ref<TemplateItem[]>([]);
const db = useTemplateDB();

const loadTemplates = async () => {
  try {
    templates.value = await db.loadAll();
  } catch {
    ElMessage.error('加载模版失败');
  }
};

// 拖拽开始时把模版内容交给画布，由 main-panel 在 drop 时实例化
const onDragStart = (tpl: TemplateItem) => {
  globalStore.setIntention('create');
  globalStore.setCreateTemplateInfo(objectDeepClone(tpl.content));
};

// 拖拽结束：若未成功落到画布则清理状态，避免残留导致后续误创建
const onDragEnd = () => {
  if (globalStore.create_template_info) {
    globalStore.setCreateTemplateInfo(null);
    globalStore.setIntention('none');
  }
};

const onDelete = (tpl: TemplateItem) => {
  ElMessageBox.confirm(`确定删除模版「${tpl.name}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      await db.remove(tpl.id);
      await loadTemplates();
      ElMessage.success('已删除');
    })
    .catch(() => {});
};

onMounted(loadTemplates);

defineExpose({ loadTemplates });
</script>
<style scoped>
#mt-template-aside :deep(.el-collapse-item__header),
#mt-template-aside :deep(.el-collapse-item__wrap) {
  background-color: transparent !important;
}
</style>
