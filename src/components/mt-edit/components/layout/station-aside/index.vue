<template>
  <div id="mt-station-aside" class="h-1/1 flex flex-col p-10px box-border">
    <div class="flex-1 min-h-0 overflow-hidden">
      <el-scrollbar :view-style="{ height: '100%' }">
        <el-empty v-if="!stationAsideProps.stations.length" description="暂无场站" />
        <el-collapse v-model="active_names" class="w-1/1">
          <el-collapse-item
            v-for="station in stationAsideProps.stations"
            :key="station.id"
            :name="station.id"
          >
            <template #title>
              <div class="flex items-center w-1/1 pr-10px">
                <el-text truncated class="max-w-140px">{{ station.name }}</el-text>
              </div>
            </template>
            <div class="grid grid-cols-2 gap-10px">
              <div
                v-for="diagram in station.diagrams"
                :key="diagram.id"
                class="relative group"
              >
                <div
                  class="w-1/1 h-50px border-2 border-transparent rounded cursor-pointer transition-all box-border hover:border-blue-500 flex items-center justify-center bg-gray-50 overflow-hidden"
                  @click="onLoadDiagram(station.id, diagram.id)"
                >
                  <img
                    :src="diagram.thumbnail"
                    class="max-w-1/1 max-h-1/1 object-cover"
                    alt="diagram thumbnail"
                  />
                </div>
                <div class="mt-4px text-xs text-center truncate px-2px">
                  {{ diagram.id }}
                </div>
                <div
                  class="absolute right-4px top-4px opacity-0 group-hover:opacity-100 transition-opacity"
                  @click.stop="onDeleteDiagramClick(station.id, diagram.id)"
                >
                  <el-button type="danger" size="small" circle>
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
              <div
                class="h-80px border border-dashed border-gray-400 rounded flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:text-blue-500 transition-all"
                @click="onAddDiagram(station.id)"
              >
                <el-icon :size="20"><Plus /></el-icon>
                <span class="mt-4px text-sm">添加</span>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-scrollbar>
    </div>
    <div class="h-[calc(10%-1px)] flex justify-center items-center ct-border">
      <el-button class="w-80/100" type="primary" @click="manageVisible = true">管理场站</el-button>
    </div>

    <!-- 管理场站弹窗 -->
    <el-dialog v-model="manageVisible" title="管理场站" width="680px" destroy-on-close>
      <div class="mb-12px flex justify-end gap-8px">
        <el-button type="primary" size="small" @click="onExportClick">
          <el-icon class="mr-4px"><Download /></el-icon>导出场站工程包
        </el-button>
        <el-button type="primary" size="small" @click="onImportClick">
          <el-icon class="mr-4px"><Upload /></el-icon>导入场站工程包
        </el-button>
        <el-button type="primary" size="small" @click="onAddStationClick">添加场站</el-button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          class="hidden"
          @change="onFileChange"
        />
      </div>
      <el-table :data="stationAsideProps.stations" border stripe max-height="400px">
        <el-table-column prop="name" label="场站名称" width="140" show-overflow-tooltip />
        <el-table-column prop="address" label="详细地址" min-width="160" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP 地址" width="130" show-overflow-tooltip />
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="onEditClick(row)">编辑</el-button>
            <el-button text type="danger" size="small" @click="onDelStationConfirm(row.id)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="manageVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑场站弹窗 -->
    <el-dialog
      v-model="dialog_visible"
      :title="editingStationId ? '编辑场站' : '新增场站'"
      width="520px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        label-position="right"
      >
        <el-form-item label="场站名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入场站名称" />
        </el-form-item>
        <el-form-item label="详细地址" prop="address">
          <el-input v-model="form.address" placeholder="请输入详细地址" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="SN 号">
              <el-input v-model="form.sn" placeholder="请输入 SN 号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="IP 地址">
              <el-input v-model="form.ip" placeholder="请输入 IP 地址" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="通信端口">
              <el-input v-model="form.port" placeholder="请输入通信端口" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="接口基地址">
              <el-input v-model="form.baseUrl" placeholder="请输入接口基地址" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog_visible = false">取消</el-button>
        <el-button type="primary" @click="onConfirm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive } from 'vue';
import {
  ElButton,
  ElCollapse,
  ElCollapseItem,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessageBox,
  ElRow,
  ElCol,
  ElScrollbar,
  ElTable,
  ElTableColumn,
  ElText,
  type FormInstance,
  type FormRules
} from 'element-plus';
import { Plus, Delete, Download, Upload } from '@element-plus/icons-vue';
import type { Station, StationForm } from './types';
import { randomString } from '@/components/mt-edit/utils';

type StationAsideProps = {
  stations: Station[];
};
const stationAsideProps = withDefaults(defineProps<StationAsideProps>(), {
  stations: () => []
});
const emits = defineEmits<{
  addStation: [station: Station];
  editStation: [station: Station];
  addDiagram: [stationId: string];
  loadDiagram: [stationId: string, diagramId: string];
  deleteStation: [stationId: string];
  deleteDiagram: [stationId: string, diagramId: string];
  exportStations: [];
  importStations: [file: File];
}>();

const dialog_visible = ref(false);
const manageVisible = ref(false);
const editingStationId = ref<string | null>(null);
const formRef = ref<FormInstance>();
const fileInputRef = ref<HTMLInputElement>();
const active_names = ref<string[]>([]);
const form = reactive<StationForm>({
  name: '',
  address: '',
  sn: '',
  ip: '',
  port: '',
  baseUrl: '',
  remark: ''
});
const rules = reactive<FormRules<StationForm>>({
  name: [{ required: true, message: '请输入场站名称', trigger: 'blur' }],
  address: [{ required: true, message: '请输入详细地址', trigger: 'blur' }]
});

const resetForm = () => {
  form.name = '';
  form.address = '';
  form.sn = '';
  form.ip = '';
  form.port = '';
  form.baseUrl = '';
  form.remark = '';
  editingStationId.value = null;
};

const onAddStationClick = () => {
  resetForm();
  dialog_visible.value = true;
};

const onExportClick = () => {
  emits('exportStations');
};

const onImportClick = () => {
  fileInputRef.value?.click();
};

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    emits('importStations', file);
  }
  // 重置以便同一文件可重复选择
  target.value = '';
};

const onEditClick = (station: Station) => {
  editingStationId.value = station.id;
  form.name = station.name;
  form.address = station.address;
  form.sn = station.sn || '';
  form.ip = station.ip || '';
  form.port = station.port || '';
  form.baseUrl = station.baseUrl || '';
  form.remark = station.remark || '';
  dialog_visible.value = true;
};

const onDelStationConfirm = (stationId: string) => {
  ElMessageBox.confirm('确定删除该场站吗？场站下所有一次图也将被删除。', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      emits('deleteStation', stationId);
    })
    .catch(() => {});
};

const onConfirm = () => {
  formRef.value?.validate((valid) => {
    if (!valid) {
      return;
    }
    if (editingStationId.value) {
      // 编辑模式：保留原 ID 和一次图数据
      const station = stationAsideProps.stations.find((f) => f.id === editingStationId.value);
      const updated: Station = {
        id: editingStationId.value,
        name: form.name,
        address: form.address,
        sn: form.sn,
        ip: form.ip,
        port: form.port,
        baseUrl: form.baseUrl,
        remark: form.remark,
        diagrams: station?.diagrams || []
      };
      emits('editStation', updated);
    } else {
      // 新增模式
      const new_station: Station = {
        id: 'station-' + randomString(),
        name: form.name,
        address: form.address,
        sn: form.sn,
        ip: form.ip,
        port: form.port,
        baseUrl: form.baseUrl,
        remark: form.remark,
        diagrams: []
      };
      emits('addStation', new_station);
      active_names.value = [new_station.id];
    }
    dialog_visible.value = false;
  });
};

const onAddDiagram = (stationId: string) => {
  emits('addDiagram', stationId);
};

const onLoadDiagram = (stationId: string, diagramId: string) => {
  emits('loadDiagram', stationId, diagramId);
};

const onDeleteDiagramClick = (stationId: string, diagramId: string) => {
  ElMessageBox.confirm('确定删除该一次接线图吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      emits('deleteDiagram', stationId, diagramId);
    })
    .catch(() => {});
};
</script>
<style scoped>
#mt-station-aside :deep(.el-collapse-item__header),
#mt-station-aside :deep(.el-collapse-item__wrap) {
  background-color: transparent !important;
}
</style>
