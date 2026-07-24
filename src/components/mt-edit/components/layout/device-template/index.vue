<template>
  <div id="mt-device-template" class="h-1/1 flex flex-col p-10px box-border">
    <div class="flex flex-col gap-6px mb-10px">
      <!-- <el-text type="info" size="small">设备类型模版（数据来自本地 SQLite）</el-text> -->
      <div class="flex items-center gap-6px">
        <el-button type="primary" size="small" @click="fileInputRef?.click()">
          导入Excel
        </el-button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="hidden"
          @change="onFileChange"
        />
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-hidden">
      <el-scrollbar :view-style="{ height: '100%' }">
        <el-empty v-if="!deviceTypes.length" description="暂无设备类型，请先导入" />
        <el-table v-else :data="deviceTypes" border stripe size="small" max-height="100%">
          <el-table-column prop="name" label="设备类型" min-width="140" show-overflow-tooltip />
          <el-table-column prop="typeCode" label="类型" width="64" align="center" />
          <el-table-column label="测点" width="90" align="center">
            <template #default="{ row }">
              <span>{{ row.selectedCount }}/{{ row.pointCount }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="72" align="center" fixed="right">
            <template #default="{ row }">
              <el-button text type="primary" size="small" @click="onEdit(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-scrollbar>
    </div>

    <!-- 测点配置弹窗：多选该设备类型需展示的测点 -->
    <el-dialog
      v-model="dialogVisible"
      :title="`配置测点 - ${currentDevice}`"
      width="min(760px, 92vw)"
      destroy-on-close
      @opened="onDialogOpened"
    >
      <div class="mb-10px flex items-center justify-between">
        <el-text type="info" size="small">
          已选 {{ selectedIds.length }} / {{ points.length }} 项
        </el-text>
        <div class="flex items-center gap-6px">
          <el-button size="small" @click="onSelectAll(true)">全选</el-button>
          <el-button size="small" @click="onSelectAll(false)">取消全选</el-button>
        </div>
      </div>
      <el-table
        ref="tableRef"
        :data="points"
        border
        stripe
        size="small"
        max-height="420px"
        row-key="id"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="46" reserve-selection />
        <el-table-column prop="pointName" label="点名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="displayName" label="展示名称" width="100" show-overflow-tooltip />
        <el-table-column prop="innerId" label="属性标识" min-width="130" show-overflow-tooltip />
        <el-table-column prop="dataType" label="类型" width="72" />
        <el-table-column prop="unit" label="单位" width="64" />
      </el-table>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  ElButton,
  ElDialog,
  ElEmpty,
  ElScrollbar,
  ElTable,
  ElTableColumn,
  ElText,
  ElMessage
} from 'element-plus';
import { useDeviceTemplateDB } from '@/composables/useDeviceTemplateDB';
import { useDeviceTypes } from '@/composables/useDeviceTypes';
import type { DevicePointRow, DeviceTemplateSelectionChange, DeviceTypeRow } from './types';

const emit = defineEmits<{
  selectionSaved: [payload: DeviceTemplateSelectionChange];
}>();

const db = useDeviceTemplateDB();

// 与绑定面板共用同一份共享设备类型状态：导入后刷新即可同步到绑定下拉
const { deviceTypes, loadDeviceTypes } = useDeviceTypes();
const fileInputRef = ref<HTMLInputElement>();

const dialogVisible = ref(false);
const currentDevice = ref('');
const points = ref<DevicePointRow[]>([]);
const selectedIds = ref<number[]>([]);
const saving = ref(false);
const tableRef = ref<InstanceType<typeof ElTable>>();

const onFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    try {
      const count = await db.importFromXlsxFile(file);
      ElMessage.success(`已导入 ${count} 条测点`);
      await loadDeviceTypes();
    } catch {
      ElMessage.error('Excel 解析或导入失败');
    }
  }
  target.value = '';
};

const openDevicePointConfig = async (deviceType: string) => {
  const normalizedDeviceType = deviceType.trim();
  if (!normalizedDeviceType) {
    ElMessage.warning('请先选择设备类型');
    return;
  }

  currentDevice.value = normalizedDeviceType;
  points.value = [];
  selectedIds.value = [];
  // 先加载数据再展示对话框，确保 opened 回调能正确回填选中态
  try {
    points.value = await db.listPointsByDevice(normalizedDeviceType);
  } catch {
    ElMessage.error('加载测点失败');
  }
  dialogVisible.value = true;
};

const onEdit = (row: DeviceTypeRow) => openDevicePointConfig(row.name);

const onDialogOpened = () => {
  // 依据数据库中的 selected 标记回填多选
  tableRef.value?.clearSelection();
  for (const p of points.value) {
    if (p.selected === 1) {
      tableRef.value?.toggleRowSelection(p, true);
    }
  }
};

const onSelectionChange = (val: DevicePointRow[]) => {
  selectedIds.value = val.map((r) => r.id);
};

const onSelectAll = (checked: boolean) => {
  if (!tableRef.value) return;
  for (const p of points.value) {
    tableRef.value.toggleRowSelection(p, checked);
  }
};

const onSave = async () => {
  saving.value = true;
  try {
    // 跨 IPC 前转成普通数组：selectedIds.value 是 Vue reactive 代理，
    // ipcRenderer.invoke 的结构化克隆无法克隆 Proxy，会抛 "An object could not be cloned"
    await db.saveSelection(currentDevice.value, [...selectedIds.value]);
    const selectedIdSet = new Set(selectedIds.value);
    const selectedPoints = points.value
      .filter((point) => selectedIdSet.has(point.id))
      .map((point) => ({ ...point, selected: 1 }));

    // 画布上的测点面板是绑定时生成的快照，保存后显式通知画布按最新配置重建。
    emit('selectionSaved', {
      deviceType: currentDevice.value,
      points: selectedPoints
    });
    ElMessage.success('测点配置已保存');
    dialogVisible.value = false;
    await loadDeviceTypes();
  } catch (err) {
    console.error('[device-template] saveSelection 失败', err);
    ElMessage.error('保存失败：' + (err instanceof Error ? err.message : String(err)));
  } finally {
    saving.value = false;
  }
};

onMounted(loadDeviceTypes);

defineExpose({ loadDeviceTypes, openDevicePointConfig });
</script>
<style scoped>
#mt-device-template :deep(.el-table) {
  --el-table-border-color: var(--el-border-color);
}
</style>
