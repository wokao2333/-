<template>
  <el-dialog
    :model-value="modelValue"
    title="上传 SVG 图元"
    width="460px"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="80px">
      <el-form-item label="图元名称">
        <el-input
          v-model="form.title"
          maxlength="64"
          show-word-limit
          placeholder="请输入图元名称"
        />
      </el-form-item>
      <el-form-item label="所属分类">
        <div class="flex flex-col gap-4px w-full">
          <el-select
            v-model="form.category"
            class="w-full"
            filterable
            allow-create
            default-first-option
            clearable
            :reserve-keyword="false"
            placeholder="选择现有分类或输入新分类"
          >
            <el-option
              v-for="category in categories"
              :key="category"
              :label="category"
              :value="category"
            />
          </el-select>
          <el-text type="info" size="small">输入新分类名称后按 Enter 即可创建。</el-text>
        </div>
      </el-form-item>
      <el-form-item label="SVG 文件">
        <input
          ref="fileInput"
          class="hidden"
          type="file"
          accept=".svg,image/svg+xml"
          @change="onFileChange"
        />
        <div class="flex flex-col gap-8px w-full">
          <div class="flex items-center gap-8px">
            <el-button @click="fileInput?.click()">选择 SVG</el-button>
            <el-text v-if="fileName" truncated>{{ fileName }}</el-text>
            <el-text v-else type="info">未选择文件</el-text>
          </div>
          <el-image
            v-if="previewUrl"
            class="w-90px h-90px border border-solid border-gray-200 rounded-2px"
            :src="previewUrl"
            fit="contain"
          />
          <el-text type="info" size="small"> 仅支持 SVG；文件和图元内容均不超过 256 KiB。 </el-text>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!canSubmit" @click="submit">上传</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElImage,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElText
} from 'element-plus';
import {
  DEFAULT_CUSTOM_SYMBOL_CATEGORY,
  type CustomSymbolDraft
} from '@/components/mt-edit/composables/use-custom-symbols';
import { parseUploadedSvg, SvgUploadError } from '@/components/mt-edit/utils/svg-upload';

type Props = {
  modelValue: boolean;
  defaultCategory?: string;
  categories?: string[];
};

const props = withDefaults(defineProps<Props>(), {
  defaultCategory: DEFAULT_CUSTOM_SYMBOL_CATEGORY,
  categories: () => []
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  submit: [draft: CustomSymbolDraft];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const fileName = ref('');
const sourceSvg = ref('');
const previewUrl = ref('');
const form = reactive({
  title: '',
  category: props.defaultCategory
});

const canSubmit = computed(() =>
  Boolean(form.title.trim() && form.category.trim() && sourceSvg.value)
);
const hasControlCharacter = (value: string) => /[\u0000-\u001f\u007f-\u009f]/.test(value);

const makeSymbolId = () => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return `custom-svg-${randomUuid || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
};

const reset = () => {
  fileName.value = '';
  sourceSvg.value = '';
  previewUrl.value = '';
  form.title = '';
  form.category = props.defaultCategory;
  if (fileInput.value) fileInput.value.value = '';
};

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) reset();
  }
);

watch(
  () => props.defaultCategory,
  (category) => {
    if (!form.category || form.category === DEFAULT_CUSTOM_SYMBOL_CATEGORY) {
      form.category = category;
    }
  }
);

const onFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  fileName.value = file.name;
  form.title = file.name.replace(/\.svg$/i, '').slice(0, 64);

  try {
    if (!file.name.toLowerCase().endsWith('.svg')) {
      throw new SvgUploadError('只允许上传 .svg 文件');
    }
    const source = await file.text();
    const parsed = parseUploadedSvg(source, makeSymbolId());
    sourceSvg.value = parsed.svg;
    previewUrl.value = parsed.thumbnail;
  } catch (error) {
    sourceSvg.value = '';
    previewUrl.value = '';
    const message = error instanceof Error ? error.message : 'SVG 文件校验失败';
    ElMessage.error(message);
  } finally {
    // 允许重新选择同一个文件并再次触发 change。
    input.value = '';
  }
};

const submit = () => {
  const title = form.title.trim();
  const category = form.category.trim();
  if (!title || title.length > 64) {
    ElMessage.error('图元名称不能为空且不能超过 64 个字符');
    return;
  }
  if (hasControlCharacter(title)) {
    ElMessage.error('图元名称不能包含控制字符');
    return;
  }
  if (!category || category.length > 64) {
    ElMessage.error('图元分类不能为空且不能超过 64 个字符');
    return;
  }
  if (hasControlCharacter(category)) {
    ElMessage.error('图元分类不能包含控制字符');
    return;
  }
  if (category === '系统组件') {
    ElMessage.error('系统组件分类由系统保留，请更换分类');
    return;
  }

  const id = makeSymbolId();
  try {
    const parsed = parseUploadedSvg(sourceSvg.value, id);
    emit('submit', {
      id,
      title,
      category,
      svg: parsed.svg,
      props: {},
      device: false,
      attachLabel: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SVG 文件校验失败';
    ElMessage.error(message);
  }
};
</script>
