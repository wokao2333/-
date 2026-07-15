<template>
  <div class="preview-page-root">
    <mt-preview ref="MtPreviewRef" @on-event-call-back="onEventCallBack"></mt-preview>
  </div>
</template>
<script setup lang="ts">
import { MtPreview } from '@/export';
import { onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  collectDeviceBindings,
  fetchDeviceRealtime,
  formatDeviceValue,
  getPhaseValueColor,
  getRealtimePointUnit,
  getValueByPath,
  kvUnitTargetAttr,
  kvValueColorTargetAttr,
  normalizeDeviceApiConfig,
  type DeviceApiConfig,
  type DeviceBindingExportJson
} from '@/composables/useDeviceBinding';
const MtPreviewRef = ref<InstanceType<typeof MtPreview>>();
let deviceRefreshTimer: number | undefined;
let realtimeErrorShown = false;
const onEventCallBack = (type: string, item_id: string) => {
  console.log(type, item_id);

  if (type == 'test-dialog') {
    ElMessage.success(`获取到了id:${item_id}`);
  }
};

const getPreviewJson = () => {
  const raw = sessionStorage.getItem('exportJson');

  if (!raw) {
    ElMessage.warning('没有找到预览数据');
    return null;
  }

  try {
    return JSON.parse(raw) as DeviceBindingExportJson;
  } catch (error) {
    ElMessage.error('预览数据格式错误');
    console.error(error);
    return null;
  }
};

const refreshDeviceData = async (
  exportJson: DeviceBindingExportJson,
  apiConfig: DeviceApiConfig
) => {
  const bindings = collectDeviceBindings(exportJson);

  if (!bindings.length) {
    return;
  }

  try {
    const response = await fetchDeviceRealtime(
      apiConfig,
      bindings.map((item) => item.bind.deviceId)
    );

    bindings.forEach(({ itemId, itemTag, bind }) => {
      const deviceData = response.data[bind.deviceId];
      const rawValue = getValueByPath(deviceData, bind.dataKey);
      const displayValue = formatDeviceValue(rawValue);
      const displayUnit = getRealtimePointUnit(rawValue, bind.unit);

      if (bind.nameTargetAttr) {
        MtPreviewRef.value?.setItemAttrByID(
          itemId,
          bind.nameTargetAttr,
          bind.fieldName || bind.dataKey
        );
      }
      MtPreviewRef.value?.setItemAttrByID(itemId, bind.targetAttr, displayValue);

      if (itemTag === 'kv-vue') {
        MtPreviewRef.value?.setItemAttrByID(itemId, kvUnitTargetAttr, displayUnit);
        MtPreviewRef.value?.setItemAttrByID(
          itemId,
          kvValueColorTargetAttr,
          getPhaseValueColor(bind.fieldName || bind.dataKey)
        );
      }
    });

    realtimeErrorShown = false;
  } catch (error) {
    if (!realtimeErrorShown) {
      ElMessage.error('设备实时数据获取失败，请确认后端服务已启动');
      realtimeErrorShown = true;
    }
    console.error(error);
  }
};

onMounted(() => {
  const exportJson = getPreviewJson();

  if (!exportJson) {
    return;
  }

  MtPreviewRef.value?.setImportJson(exportJson);
  const apiConfig = normalizeDeviceApiConfig(exportJson.deviceApiConfig);
  refreshDeviceData(exportJson, apiConfig);
  deviceRefreshTimer = window.setInterval(() => {
    refreshDeviceData(exportJson, apiConfig);
  }, apiConfig.refreshInterval);
});

onUnmounted(() => {
  if (deviceRefreshTimer) {
    window.clearInterval(deviceRefreshTimer);
  }
});
</script>

<style scoped>
.preview-page-root {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
}
</style>
