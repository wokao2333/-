<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import type { IExportJson } from '@/components/mt-edit/components/types';
import { useGenThumbnail } from '@/components/mt-edit/composables/thumbnail';
import { MtEdit } from '@/export';
import { useRouter } from 'vue-router';
import {
  ElAlert,
  ElButton,
  ElCollapse,
  ElCollapseItem,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElText
} from 'element-plus';
import {
  attachDeviceApiConfig,
  canBindDeviceValue,
  ensureDeviceBind,
  fetchDeviceFields,
  fetchDevices,
  getDeviceNameTargetOptions,
  getDeviceTargetOptions,
  loadDeviceApiConfig,
  normalizeDeviceApiConfig,
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

const router = useRouter();
const devices = ref<DeviceInfo[]>([]);
const deviceFields = ref<DeviceField[]>([]);
const deviceOptionsLoading = shallowRef(false);
const deviceOptionsError = shallowRef('');
const sourcePanelActiveNames = ref<string[]>([]);
const apiConfig = reactive<DeviceApiConfig>(loadDeviceApiConfig());

const fieldListNeedsDevice = computed(() => apiConfig.fieldListUrl.includes('{deviceId}'));

const saveCurrentApiConfig = () => {
  saveDeviceApiConfig(apiConfig);
  ElMessage.success('数据源配置已保存');
};

const resetCurrentApiConfig = () => {
  Object.assign(apiConfig, resetDeviceApiConfig());
  saveDeviceApiConfig(apiConfig);
  devices.value = [];
  deviceFields.value = [];
  ElMessage.success('已恢复默认接口配置');
};

const loadDeviceFields = async (deviceId = '') => {
  deviceFields.value = await fetchDeviceFields(apiConfig, deviceId);
};

const loadDeviceOptions = async () => {
  deviceOptionsLoading.value = true;
  deviceOptionsError.value = '';

  try {
    devices.value = await fetchDevices(apiConfig);

    if (fieldListNeedsDevice.value) {
      deviceFields.value = [];
    } else {
      await loadDeviceFields();
    }

    saveDeviceApiConfig(apiConfig);
    ElMessage.success(`已加载 ${devices.value.length} 个设备`);
  } catch (error) {
    deviceOptionsError.value = '设备列表或属性列表加载失败，请检查接口地址和路径映射';
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
    return;
  }

  try {
    if (fieldListNeedsDevice.value) {
      deviceOptionsLoading.value = true;
      await loadDeviceFields(bind.deviceId);
    }

    setDefaultField(item);
  } catch (error) {
    ElMessage.error('设备属性加载失败，请检查属性接口配置');
    console.error(error);
  } finally {
    deviceOptionsLoading.value = false;
  }
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

onMounted(() => {
  loadDeviceOptions();
});
</script>

<template>
  <div class="edit-page">
    <div class="device-source-panel">
      <el-collapse v-model="sourcePanelActiveNames">
        <el-collapse-item name="deviceSource">
          <template #title>
            <div class="source-title">
              <span>数据源配置</span>
              <el-text size="small" type="info">
                {{ devices.length }} 个设备 / {{ deviceFields.length }} 个属性
              </el-text>
            </div>
          </template>
          <el-form label-width="110px" label-position="left" size="small">
            <div class="source-grid">
              <el-form-item label="设备列表接口">
                <el-input v-model="apiConfig.deviceListUrl" placeholder="/api/devices" />
              </el-form-item>
              <el-form-item label="设备列表路径">
                <el-input
                  v-model="apiConfig.deviceListPath"
                  placeholder="例如 data.records，空为根数组"
                />
              </el-form-item>
              <el-form-item label="设备ID路径">
                <el-input v-model="apiConfig.deviceIdPath" placeholder="id / device_id" />
              </el-form-item>
              <el-form-item label="设备名称路径">
                <el-input v-model="apiConfig.deviceNamePath" placeholder="name / device_name" />
              </el-form-item>
              <el-form-item label="属性列表接口">
                <el-input
                  v-model="apiConfig.fieldListUrl"
                  placeholder="/api/device/fields 或 /api/devices/{deviceId}/fields"
                />
              </el-form-item>
              <el-form-item label="属性列表路径">
                <el-input v-model="apiConfig.fieldListPath" placeholder="例如 data，空为根数组" />
              </el-form-item>
              <el-form-item label="属性key路径">
                <el-input v-model="apiConfig.fieldKeyPath" placeholder="key" />
              </el-form-item>
              <el-form-item label="属性名称路径">
                <el-input v-model="apiConfig.fieldNamePath" placeholder="name" />
              </el-form-item>
              <el-form-item label="属性单位路径">
                <el-input v-model="apiConfig.fieldUnitPath" placeholder="unit" />
              </el-form-item>
              <el-form-item label="实时数据接口">
                <el-input
                  v-model="apiConfig.realtimeUrl"
                  placeholder="/api/device/realtime?ids={ids}"
                />
              </el-form-item>
              <el-form-item label="实时数据路径">
                <el-input v-model="apiConfig.realtimeDataPath" placeholder="data" />
              </el-form-item>
              <el-form-item label="刷新间隔">
                <el-input-number
                  v-model="apiConfig.refreshInterval"
                  :min="1000"
                  :step="1000"
                  controls-position="right"
                />
              </el-form-item>
            </div>
            <div class="source-actions">
              <el-button type="primary" :loading="deviceOptionsLoading" @click="loadDeviceOptions">
                加载设备
              </el-button>
              <el-button @click="saveCurrentApiConfig">保存配置</el-button>
              <el-button @click="resetCurrentApiConfig">恢复默认</el-button>
              <el-text v-if="fieldListNeedsDevice" size="small" type="info">
                属性接口包含 {deviceId}，选择设备后会加载该设备属性。
              </el-text>
            </div>
          </el-form>
        </el-collapse-item>
      </el-collapse>
    </div>
    <div class="editor-shell">
      <mt-edit
        :use-thumbnail="true"
        :export-extra="exportExtra"
        @on-preview-click="onPreviewClick"
        @on-import-success="onImportSuccess"
        @on-return-click="onReturnClick"
        @on-save-click="onSaveClick"
        @on-thumbnail-click="onThumbnailClick"
      >
        <template #deviceBind="{ item }">
          <el-form label-width="64px" label-position="left">
            <el-alert
              v-if="deviceOptionsError"
              :title="deviceOptionsError"
              type="error"
              :closable="false"
              class="mb-10px"
            />
            <el-alert
              v-if="!canBindDeviceValue(item)"
              title="当前图元本身不展示数值，请选中文本、按钮或键值对组件绑定。卡片通常作为容器使用。"
              type="info"
              :closable="false"
              class="mb-10px"
            />
            <el-form-item label="设备">
              <el-select
                v-model="getDeviceBind(item).deviceId"
                :loading="deviceOptionsLoading"
                filterable
                clearable
                placeholder="选择设备"
                @change="onDeviceChange(item)"
              >
                <el-option
                  v-for="device in devices"
                  :key="device.id"
                  :label="`${device.name} (${device.id})`"
                  :value="device.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="属性">
              <el-select
                v-model="getDeviceBind(item).dataKey"
                :loading="deviceOptionsLoading"
                filterable
                clearable
                placeholder="选择属性"
                @change="onDeviceFieldChange(item)"
              >
                <el-option
                  v-for="field in deviceFields"
                  :key="field.key"
                  :label="`${field.name}${field.unit ? ` (${field.unit})` : ''}`"
                  :value="field.key"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="单位">
              <el-input v-model="getDeviceBind(item).unit" placeholder="可选" />
            </el-form-item>
            <el-form-item v-if="getDeviceNameTargetOptions(item).length" label="键名写到">
              <el-select
                v-model="getDeviceBind(item).nameTargetAttr"
                clearable
                placeholder="选择键名写入属性"
                @change="onDeviceFieldChange(item)"
              >
                <el-option
                  v-for="target in getDeviceNameTargetOptions(item)"
                  :key="target.value"
                  :label="target.label"
                  :value="target.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="canBindDeviceValue(item)" label="值写到">
              <el-select v-model="getDeviceBind(item).targetAttr" placeholder="选择写入属性">
                <el-option
                  v-for="target in getDeviceTargetOptions(item)"
                  :key="target.value"
                  :label="target.label"
                  :value="target.value"
                />
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

.device-source-panel {
  flex: 0 0 auto;
  border-bottom: 1px solid #dcdfe6;
  background: #ffffff;
}

.source-title {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(260px, 1fr));
  column-gap: 16px;
  padding: 0 12px;
}

.source-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 8px;
}

.editor-shell {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
