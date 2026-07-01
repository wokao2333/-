<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue';
import type { IExportJson } from '@/components/mt-edit/components/types';
import { useGenThumbnail } from '@/components/mt-edit/composables/thumbnail';
import { MtEdit } from '@/export';
import { useRouter } from 'vue-router';
import {
  ElAlert,
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElText,
  ElUpload
} from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import {
  attachDeviceApiConfig,
  canBindDeviceValue,
  ensureDeviceBind,
  getDeviceNameTargetOptions,
  getDeviceTargetOptions,
  loadDeviceApiConfig,
  normalizeDeviceApiConfig,
  parseDeviceBindingData,
  resetDeviceApiConfig,
  saveDeviceApiConfig,
  setValueByPath,
  syncDeviceFieldMeta,
  type DeviceApiConfig,
  type DeviceBindableItem,
  type DeviceBindingExportJson,
  type DeviceField,
  type DeviceInfo
} from '@/composables/useDeviceBinding';

import { VAceEditor } from 'vue3-ace-editor';

const router = useRouter();
const devices = ref<DeviceInfo[]>([]);
const deviceFields = ref<DeviceField[]>([]);
const deviceFieldsMap = ref<Record<string, DeviceField[]>>({});
const deviceOptionsLoading = shallowRef(false);
const deviceOptionsError = shallowRef('');
const dataSourceVisible = ref(false);
const apiConfig = reactive<DeviceApiConfig>(loadDeviceApiConfig());
const bindingJsonText = ref('');
const bindingJsonParsed = shallowRef(false);

const clearBindingJson = () => {
  devices.value = [];
  deviceFields.value = [];
  deviceFieldsMap.value = {};
  bindingJsonText.value = '';
  bindingJsonParsed.value = false;
  ElMessage.success('已清空数据');
};

const parseBindingJson = () => {
  if (!bindingJsonText.value.trim()) {
    ElMessage.warning('请先粘贴或导入 JSON 数据');
    return;
  }

  try {
    const parsed = parseDeviceBindingData(JSON.parse(bindingJsonText.value));

    devices.value = parsed.devices;
    deviceFieldsMap.value = parsed.fieldsMap;
    deviceFields.value = Object.values(parsed.fieldsMap).flat();
    bindingJsonParsed.value = true;
    deviceOptionsError.value = '';

    ElMessage.success(
      `已解析 ${parsed.devices.length} 个设备，共 ${deviceFields.value.length} 个属性`
    );
  } catch (error) {
    deviceOptionsError.value = 'JSON 解析失败，请检查数据格式';
    ElMessage.error(deviceOptionsError.value);
    console.error(error);
  }
};

const handleJsonFileUpload = (file: File) => {
  const reader = new FileReader();

  reader.onload = (event) => {
    bindingJsonText.value = (event.target?.result as string) || '';
    ElMessage.success('文件已加载，请点击"解析数据"按钮');
  };

  reader.onerror = () => {
    ElMessage.error('文件读取失败');
  };

  reader.readAsText(file);
  return false; // 阻止 el-upload 默认上传
};

const loadDeviceOptions = async () => {
  deviceOptionsLoading.value = true;
  deviceOptionsError.value = '';

  try {
    parseBindingJson();
    saveDeviceApiConfig(apiConfig);
  } catch (error) {
    deviceOptionsError.value = '设备数据解析失败，请检查 JSON 格式';
    ElMessage.error(deviceOptionsError.value);
    console.error(error);
  } finally {
    deviceOptionsLoading.value = false;
  }
};

const getDeviceBind = (item: DeviceBindableItem) => ensureDeviceBind(item);

const setDefaultField = (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);

  if (!bind.dataKey && deviceFields.value[0]) {
    bind.dataKey = deviceFields.value[0].key;
    syncDeviceFieldMeta(bind, deviceFields.value);
  }
};

const onDeviceChange = async (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);

  bind.dataKey = '';
  bind.fieldName = '';
  bind.unit = '';

  if (!bind.deviceId) {
    deviceFields.value = Object.values(deviceFieldsMap.value).flat();
    return;
  }

  // 从解析的 fieldsMap 中按 deviceId 筛选字段
  const fields = deviceFieldsMap.value[bind.deviceId] || [];
  deviceFields.value = fields;
  setDefaultField(item);
};

const onDeviceFieldChange = (item: DeviceBindableItem) => {
  const bind = ensureDeviceBind(item);
  syncDeviceFieldMeta(bind, deviceFields.value);

  if (bind.nameTargetAttr && bind.fieldName) {
    setValueByPath(item, bind.nameTargetAttr, bind.fieldName);
  }
};

const withDeviceSourceConfig = (exportJson: IExportJson) => {
  const normalizedConfig = normalizeDeviceApiConfig(apiConfig);
  saveDeviceApiConfig(normalizedConfig);
  return attachDeviceApiConfig(exportJson, normalizedConfig);
};

const exportExtra = computed(() => ({
  deviceApiConfig: normalizeDeviceApiConfig(apiConfig)
}));

const onImportSuccess = async (exportJson: DeviceBindingExportJson) => {
  if (!exportJson.deviceApiConfig) {
    return;
  }

  Object.assign(apiConfig, normalizeDeviceApiConfig(exportJson.deviceApiConfig));
  saveDeviceApiConfig(apiConfig);
  await loadDeviceOptions();
};

const onPreviewClick = (exportJson: IExportJson) => {
  sessionStorage.setItem('exportJson', JSON.stringify(withDeviceSourceConfig(exportJson)));
  const routeUrl = router.resolve({
    name: 'preview'
  });
  window.open(routeUrl.href, '_blank');
};

const onSaveClick = (exportJson: IExportJson) => {
  console.log(withDeviceSourceConfig(exportJson), '这是要保存的数据');
};

const onReturnClick = () => {
  router.go(-1);
};

const onThumbnailClick = () => {
  useGenThumbnail();
};

/* 页面挂载时不自动加载，改为用户在对话框中手动导入 JSON */

</script>

<template>
  <div class="edit-page">
    <el-dialog v-model="dataSourceVisible" title="数据源配置" width="960px" :close-on-click-modal="false"
      @closed="deviceFields = Object.values(deviceFieldsMap).flat()">
      <template #header>
        <div class="source-dialog-header">
          <span>数据源配置</span>
          <el-text size="small" type="info" class="ml-12px">
            {{ devices.length }} 个设备 / {{ deviceFields.length }} 个属性
          </el-text>
        </div>
      </template>
      <div class="source-body">
        <!-- JSON 导入区域 -->
        <div class="source-upload-area">
          <div class="source-upload-row">
            <el-upload :auto-upload="false" :show-file-list="false" accept=".json"
              :on-change="(file: any) => handleJsonFileUpload(file.raw)">
              <el-button type="primary" plain>
                <el-icon class="mr-4px">
                  <Upload />
                </el-icon>
                导入 JSON 文件
              </el-button>
            </el-upload>
            <el-button type="success" :disabled="!bindingJsonText.trim()" @click="parseBindingJson">
              解析数据
            </el-button>
            <el-text v-if="bindingJsonParsed" type="success" size="small">
              ✓ 已解析
            </el-text>
            <el-text v-else-if="bindingJsonText.trim()" type="warning" size="small">
              待解析
            </el-text>
          </div>
          <div class="source-editor-wrapper">
            <v-ace-editor v-model:value="bindingJsonText" lang="json" theme="monokai" style="height: 320px" :options="{
              useWorker: true,
              enableBasicAutocompletion: true,
              enableSnippets: true,
              enableLiveAutocompletion: true
            }" />
          </div>
          <el-text size="small" type="info">
            支持粘贴后端返回的 JSON 数据或导入 .json 文件，格式：{ "code": 200, "data": [{ "deviceId": "...", "deviceName": "...", "points":
            [...]
            }] }
          </el-text>
        </div>

      </div>
      <template #footer>
        <el-button type="danger" plain :disabled="!bindingJsonText.trim() && !bindingJsonParsed"
          @click="clearBindingJson">
          清空数据
        </el-button>
        <el-button type="primary" @click="dataSourceVisible = false">确定</el-button>
      </template>
    </el-dialog>
    <div class="editor-shell">
      <mt-edit :use-thumbnail="true" :export-extra="exportExtra" @on-preview-click="onPreviewClick"
        @on-import-success="onImportSuccess" @on-return-click="onReturnClick" @on-save-click="onSaveClick"
        @on-thumbnail-click="onThumbnailClick" @on-data-source-click="dataSourceVisible = true">
        <template #deviceBind="{ item }">
          <el-form label-width="64px" label-position="left">
            <el-alert v-if="deviceOptionsError" :title="deviceOptionsError" type="error" :closable="false"
              class="mb-10px" />
            <el-alert v-if="!canBindDeviceValue(item)" title="当前图元本身不展示数值，请选中文本、按钮或键值对组件绑定。卡片通常作为容器使用。" type="info"
              :closable="false" class="mb-10px" />
            <el-form-item label="设备">
              <el-select v-model="getDeviceBind(item).deviceId" :loading="deviceOptionsLoading" filterable clearable
                placeholder="选择设备" @change="onDeviceChange(item)">
                <el-option v-for="device in devices" :key="device.id" :label="`${device.name} (${device.id})`"
                  :value="device.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="属性">
              <el-select v-model="getDeviceBind(item).dataKey" :loading="deviceOptionsLoading" filterable clearable
                placeholder="选择属性" @change="onDeviceFieldChange(item)">
                <el-option v-for="field in deviceFields" :key="field.key"
                  :label="`${field.name}${field.unit ? ` (${field.unit})` : ''}`" :value="field.key" />
              </el-select>
            </el-form-item>
            <el-form-item label="单位">
              <el-input v-model="getDeviceBind(item).unit" placeholder="可选" />
            </el-form-item>
            <el-form-item v-if="getDeviceNameTargetOptions(item).length" label="键名写到">
              <el-select v-model="getDeviceBind(item).nameTargetAttr" clearable placeholder="选择键名写入属性"
                @change="onDeviceFieldChange(item)">
                <el-option v-for="target in getDeviceNameTargetOptions(item)" :key="target.value" :label="target.label"
                  :value="target.value" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="canBindDeviceValue(item)" label="值写到">
              <el-select v-model="getDeviceBind(item).targetAttr" placeholder="选择写入属性">
                <el-option v-for="target in getDeviceTargetOptions(item)" :key="target.value" :label="target.label"
                  :value="target.value" />
              </el-select>
            </el-form-item>
            <el-text size="small" type="info">
              键名会写入字段 name，键值会从实时接口读取 dataKey 对应的值。
            </el-text>
          </el-form>
        </template>
      </mt-edit>
    </div>
  </div>
</template>

<style scoped>
.edit-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.source-dialog-header {
  display: flex;
  align-items: center;
}

.source-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-upload-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.source-editor-wrapper {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.mr-4px {
  margin-right: 4px;
}

.source-grid-simple {
  display: grid;
  grid-template-columns: repeat(3, minmax(200px, 1fr));
  column-gap: 16px;
}


.editor-shell {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
</style>
