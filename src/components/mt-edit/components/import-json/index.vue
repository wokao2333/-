<template>
  <div>
    <v-ace-editor
      v-model:value="import_json"
      lang="json"
      theme="monokai"
      style="height: 400px"
      :options="{
        useWorker: true,
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true
      }"
    />
  </div>
</template>
<script setup lang="ts">
import { VAceEditor } from 'vue3-ace-editor';
import { ref } from 'vue';
import type { IExportJson } from '../types';
import { globalStore } from '../../store/global';
import { useExportJsonToDoneJson } from '../../composables';
const import_json = ref('');
const onImport = () => {
  return new Promise<IExportJson | false>((resolve) => {
    try {
      const json: IExportJson = JSON.parse(import_json.value);

      const { canvasCfg, gridCfg, importDoneJson } = useExportJsonToDoneJson(json);
      // 画布框架固定不变，重置视口状态（transform_origin、drag_offset），仅保留内容 scale
      canvasCfg.transform_origin = { x: 0, y: 0 };
      canvasCfg.drag_offset = { x: 0, y: 0 };
      globalStore.canvasCfg = canvasCfg;
      globalStore.gridCfg = gridCfg;
      globalStore.setGlobalStoreDoneJson(importDoneJson);
      resolve(json);
    } catch (error) {
      resolve(false);
    }
  });
};
defineExpose({
  onImport
});
</script>
