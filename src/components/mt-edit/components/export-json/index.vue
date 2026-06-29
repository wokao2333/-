<template>
  <div>
    <v-ace-editor
      v-model:value="export_json"
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
import type { IDoneJson, IGlobalStoreCanvasCfg, IGlobalStoreGridCfg } from '../../store/types';
import { computed } from 'vue';
import { genExportJson } from '../../composables';
type ExportProps = {
  doneJson: IDoneJson[];
  canvasCfg: IGlobalStoreCanvasCfg;
  gridCfg: IGlobalStoreGridCfg;
  extraJson?: Record<string, unknown>;
};
const exportProps = withDefaults(defineProps<ExportProps>(), {
  extraJson: () => ({})
});
const export_json = computed({
  get: () => {
    const { exportJson } = genExportJson(
      exportProps.canvasCfg,
      exportProps.gridCfg,
      exportProps.doneJson
    );
    return JSON.stringify(
      {
        ...exportJson,
        ...exportProps.extraJson
      },
      null,
      2
    );
  },
  set: () => {}
});
</script>
