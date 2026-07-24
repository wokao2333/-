<template>
  <el-config-provider :locale="zhCn">
    <el-tabs v-model="activeName" class="select-none">
      <!-- 页面设置面板 -->
      <el-tab-pane label="页面" name="page">
        <el-form label-width="70px" label-position="left">
          <!-- 1. 画布尺寸配置 -->
          <el-form-item label="画布尺寸" size="small">
            <el-input :model-value="canvas_size" disabled size="small" />
          </el-form-item>

          <!-- 2. 缩放倍数配置 -->
          <el-form-item label="缩放倍数" size="small">
            <el-select v-model="canvas_size_scale" placeholder="请设置缩放比例" size="small">
              <!-- 预设的缩放比例选项 -->
              <el-option
                v-for="item in canvas_size_scale_options"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
              <!-- 自定义缩放比例输入框 -->
              <div class="flex justify-between px-10px ct-border pt-10px">
                <el-text>自定义:</el-text>
                <el-input-number
                  v-model="canvas_size_scale_input"
                  size="small"
                  :step="0.1"
                  :min="0.1"
                  class="mx-5px"
                ></el-input-number>
              </div>
            </el-select>
          </el-form-item>

          <!-- 3. 背景颜色选择器 -->
          <el-form-item label="背景颜色" size="small">
            <el-color-picker v-model="canvas_bg_color"></el-color-picker>
          </el-form-item>

          <!-- 4. 背景图片上传 -->
          <el-form-item label="背景图片" size="small">
            <el-upload
              ref="canvasBgImgUploadRef"
              class="w-24px h-24px"
              v-model:file-list="bg_img_list"
              :auto-upload="false"
              :limit="1"
              :show-file-list="false"
              :on-change="onBgImgChange"
              accept="image/*"
              @mouseenter="show_clear_bg_img = true"
              @mouseleave="show_clear_bg_img = false"
            >
              <div class="flex justify-center items-center relative">
                <!-- 已有背景图时展示图片缩略图，否则展示上传按钮 -->
                <img
                  class="w-40px h-40px absolute left-0"
                  v-if="rightAsideProps.canvasCfg.img"
                  :src="rightAsideProps.canvasCfg.img"
                />
                <el-button v-else size="small" class="w-40px h-40px absolute left-0">
                  <el-icon title="上传" :size="20">
                    <svg-analysis name="upload"></svg-analysis>
                  </el-icon>
                </el-button>
                <!-- 鼠标悬浮在已有背景图上时显示删除/清除按钮 -->
                <div
                  v-if="rightAsideProps.canvasCfg.img && show_clear_bg_img"
                  class="absolute w-40px h-40px left-0 opacity-80 bg-light-300 flex justify-center items-center"
                  @click.stop="clearBgImg"
                >
                  <el-icon title="删除" :size="25">
                    <svg-analysis name="delete"></svg-analysis>
                  </el-icon>
                </div>
              </div>
            </el-upload>
          </el-form-item>

          <!-- 5. 辅助功能开关：参考线 -->
          <el-form-item label="参考线" size="small">
            <el-switch v-model="canvas_guide"></el-switch>
          </el-form-item>

          <!-- 6. 辅助功能开关：吸附 -->
          <el-form-item label="吸附" size="small">
            <el-switch v-model="canvas_adsorp"></el-switch>
          </el-form-item>

          <!-- 7. 网格开关与配置 -->
          <el-form-item label="网格" size="small">
            <el-switch v-model="grid_enabled"></el-switch>
          </el-form-item>
          <!-- 仅在启用网格时展示网格对齐开关 -->
          <el-form-item label="网格对齐" size="small" v-if="grid_enabled">
            <el-switch v-model="grid_align"></el-switch>
          </el-form-item>
          <!-- 仅在启用网格时展示网格大小输入框 -->
          <el-form-item label="网格大小" size="small" v-if="grid_enabled">
            <el-input-number v-model="grid_size" :min="1"></el-input-number>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </el-config-provider>
</template>
<script setup lang="ts">
import type { IGlobalStoreCanvasCfg, IGlobalStoreGridCfg } from '@/components/mt-edit/store/types';
import {
  ElTabs,
  ElTabPane,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElSelect,
  ElOption,
  ElSwitch,
  ElText,
  ElColorPicker,
  ElUpload,
  ElIcon,
  type UploadUserFile,
  ElButton,
  type UploadFile,
  ElMessage,
  ElConfigProvider
} from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { computed, ref } from 'vue';
import SvgAnalysis from '@/components/mt-edit/components/svg-analysis/index.vue';
import { blobToBase64 } from '@/components/mt-edit/utils';

// 定义属性接口，接收父组件传递的画布配置与网格配置
type RightAsideProps = {
  canvasCfg: IGlobalStoreCanvasCfg; // 画布配置，包括宽高、缩放比、背景颜色、背景图、吸附、参考线等
  gridCfg: IGlobalStoreGridCfg; // 网格配置，包括是否启用、对齐、网格大小等
};

// 使用 withDefaults 声明 Props，这里设置为空对象作为默认值
const rightAsideProps = withDefaults(defineProps<RightAsideProps>(), {});

// 定义事件分发器，用于更新画布配置与网格配置，实现双向绑定
const emits = defineEmits(['update:canvasCfg', 'update:gridCfg']);

// 当前激活的标签页名称，默认为 "page"
const activeName = ref('page');

// 画布背景图片上传组件的引用
const canvasBgImgUploadRef = ref();

/**
 * 画布尺寸的计算属性（格式化为 "宽*高"）
 * 用于展示当前画布尺寸
 */
const canvas_size = computed(
  () => `${rightAsideProps.canvasCfg.width || 1280}*${rightAsideProps.canvasCfg.height || 750}`
);

// 自定义画布缩放比例输入框的计算属性
const canvas_size_scale_input = computed({
  get: () => {
    return rightAsideProps.canvasCfg.scale;
  },
  set: (value) => {
    emits('update:canvasCfg', {
      ...rightAsideProps.canvasCfg,
      scale: value
    });
  }
});

// 画布缩放比例下拉选择器的计算属性
const canvas_size_scale = computed({
  get: () => {
    return rightAsideProps.canvasCfg.scale;
  },
  set: (value) => {
    emits('update:canvasCfg', {
      ...rightAsideProps.canvasCfg,
      scale: value
    });
  }
});

// 预设的画布缩放比例选项
const canvas_size_scale_options = [
  {
    value: 0.5,
    label: 0.5
  },
  {
    value: 1,
    label: 1
  },
  {
    value: 1.5,
    label: 1.5
  },
  {
    value: 2,
    label: 2
  }
];

// 画布背景颜色计算属性，供颜色选择器双向绑定
const canvas_bg_color = computed({
  get: () => {
    return rightAsideProps.canvasCfg.color;
  },
  set: (value) => {
    emits('update:canvasCfg', {
      ...rightAsideProps.canvasCfg,
      color: value
    });
  }
});

// 是否显示清除背景图按钮的标识（当鼠标悬浮在上传图片区域时为 true）
const show_clear_bg_img = ref(false);

// 背景图片文件上传列表
const bg_img_list = ref<UploadUserFile[]>([]);

// 网格是否启用的计算属性
const grid_enabled = computed({
  get: () => {
    return rightAsideProps.gridCfg.enabled;
  },
  set: (value) => {
    emits('update:gridCfg', {
      ...rightAsideProps.gridCfg,
      enabled: value
    });
  }
});

// 网格对齐是否启用的计算属性
const grid_align = computed({
  get: () => {
    return rightAsideProps.gridCfg.align;
  },
  set: (value) => {
    emits('update:gridCfg', {
      ...rightAsideProps.gridCfg,
      align: value
    });
  }
});

// 网格大小的计算属性
const grid_size = computed({
  get: () => {
    return rightAsideProps.gridCfg.size;
  },
  set: (value) => {
    emits('update:gridCfg', {
      ...rightAsideProps.gridCfg,
      size: value
    });
  }
});

/**
 * 当背景图片选择发生变化时的回调
 * @param e 上传的图片文件对象
 * 负责进行图片类型校验和大小校验（最大 1MB），并通过 FileReader 将图片转为 Base64 格式
 */
const onBgImgChange = (e: UploadFile) => {
  show_clear_bg_img.value = false;
  // 仅支持上传图片类型文件
  if (!e.raw!.type.includes('image/')) {
    ElMessage.error('只能上传图片!');
    canvasBgImgUploadRef.value.clearFiles();
    bg_img_list.value = [];
    return false;
  } else if (e.raw!.size / 1024 / 1024 > 1) {
    // 限制图片大小不能超过 1MB
    ElMessage.error('不能上传超过1MB的图像!');
    canvasBgImgUploadRef.value.clearFiles();
    bg_img_list.value = [];
    return false;
  }
  // 将 Blob 转换为 Base64 格式，更新全局画布的背景图片
  blobToBase64(e.raw!).then((base64) => {
    emits('update:canvasCfg', {
      ...rightAsideProps.canvasCfg,
      img: base64
    });
  });
};

/**
 * 清除背景图片
 * 调用上传组件方法清空文件队列，同时将画布配置中的背景图地址设置为空
 */
const clearBgImg = () => {
  canvasBgImgUploadRef.value.clearFiles();
  emits('update:canvasCfg', {
    ...rightAsideProps.canvasCfg,
    img: ''
  });
};

// 画布元素吸附功能是否启用的计算属性
const canvas_adsorp = computed({
  get: () => {
    return rightAsideProps.canvasCfg.adsorp;
  },
  set: (value) => {
    emits('update:canvasCfg', {
      ...rightAsideProps.canvasCfg,
      adsorp: value
    });
  }
});

// 画布参考线是否启用的计算属性
const canvas_guide = computed({
  get: () => {
    return rightAsideProps.canvasCfg.guide;
  },
  set: (value) => {
    emits('update:canvasCfg', {
      ...rightAsideProps.canvasCfg,
      guide: value
    });
  }
});
</script>
