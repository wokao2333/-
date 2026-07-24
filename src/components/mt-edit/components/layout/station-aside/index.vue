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
                @contextmenu.prevent="onDiagramContextMenu($event, station.id, diagram)"
              >
                <div
                  class="w-1/1 h-50px border-2 rounded cursor-pointer transition-all box-border flex items-center justify-center bg-gray-50 overflow-hidden"
                  :class="[
                    isDiagramActive(station.id, diagram.id)
                      ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
                      : 'border-transparent hover:border-blue-400'
                  ]"
                  @click="onLoadDiagram(station.id, diagram.id)"
                >
                  <img
                    :src="diagram.thumbnail"
                    class="max-w-1/1 max-h-1/1 object-cover"
                    alt="diagram thumbnail"
                  />
                </div>
                <div
                  class="mt-4px text-xs text-center truncate px-2px cursor-pointer"
                  :class="
                    isDiagramActive(station.id, diagram.id)
                      ? 'text-blue-600 font-semibold'
                      : 'text-gray-700'
                  "
                  :title="diagram.name || diagram.id"
                  @click="onLoadDiagram(station.id, diagram.id)"
                >
                  {{ diagram.name || diagram.id }}
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
    <el-dialog v-model="manageVisible" title="管理场站" width="min(960px, 92vw)" destroy-on-close>
      <div class="mb-12px flex flex-wrap justify-end gap-8px">
        <el-button type="primary" size="small" @click="onAddStationClick">
          <el-icon class="mr-4px"><Plus /></el-icon>新增场站
        </el-button>
         <el-button type="primary" size="small" @click="onImportClick">
          <el-icon class="mr-4px"><Upload /></el-icon>导入场站工程包
        </el-button>
        <el-button type="primary" size="small" @click="onExportClick">
          <el-icon class="mr-4px"><Download /></el-icon>导出场站工程包
        </el-button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          class="hidden"
          @change="onFileChange"
        />
      </div>
      <el-table :data="stationAsideProps.stations" border stripe max-height="400px">
        <el-table-column prop="name" label="场站名称" width="180" show-overflow-tooltip />
        <el-table-column prop="address" label="详细地址" min-width="260" show-overflow-tooltip />
        <el-table-column label="操作" width="300" align="center" fixed="right">
          <template #default="{ row }">
            <div class="flex flex-nowrap items-center justify-center whitespace-nowrap gap-4px">
              <el-button text type="primary" size="small" @click="onEditClick(row)">编辑</el-button>
              <el-button text type="danger" size="small" @click="onDelStationConfirm(row.id)"
                >删除</el-button
              >
              <el-button text type="primary" size="small" @click="onBindMcuClick(row)"
                >MCU列表</el-button
              >
              <el-button text type="success" size="small" @click="onEnterStationClick(row)"
                >进入场站</el-button
              >
            </div>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="manageVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 绑定MCU弹窗 -->
    <el-dialog v-model="mcuVisible" title="绑定MCU" width="800px" destroy-on-close>
      <div class="mb-12px flex items-center justify-between">
        <el-text type="info" size="small">场站：{{ mcuStationName }}</el-text>
        <el-button type="primary" size="small" @click="onAddMcuRow">
          <el-icon class="mr-4px"><Plus /></el-icon>新增MCU
        </el-button>
      </div>
      <el-table :data="mcuList" border stripe max-height="380px" empty-text="暂无已绑定的MCU">
        <el-table-column label="SN号" min-width="180">
          <template #default="{ row }">
            <el-input
              v-if="editingIds.includes(row.id)"
              v-model="row.sn"
              placeholder="请输入SN号（必填）"
            />
            <span v-else>{{ row.sn || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="IP地址" min-width="160">
          <template #default="{ row }">
            <el-input
              v-if="editingIds.includes(row.id)"
              v-model="row.ip"
              placeholder="请输入IP地址"
            />
            <span v-else>{{ row.ip || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="通信端口" min-width="120">
          <template #default="{ row }">
            <el-input
              v-if="editingIds.includes(row.id)"
              v-model="row.port"
              placeholder="请输入通信端口"
            />
            <span v-else>{{ row.port || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="160">
          <template #default="{ row }">
            <el-input
              v-if="editingIds.includes(row.id)"
              v-model="row.remark"
              placeholder="请输入备注"
            />
            <span v-else>{{ row.remark || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">
            {{ row.updateTime ? formatTime(row.updateTime) : '未保存' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row, $index }">
            <template v-if="editingIds.includes(row.id)">
              <el-button text type="primary" size="small" @click="onFinishMcuRow(row.id)"
                >完成</el-button
              >
            </template>
            <template v-else>
              <el-button text type="primary" size="small" @click="onEditMcuRow(row.id)"
                >编辑</el-button
              >
            </template>
            <el-button text type="danger" size="small" @click="onRemoveMcuRow($index)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="mcuVisible = false">取消</el-button>
        <el-button type="primary" @click="onSaveMcu">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑场站弹窗 -->
    <el-dialog
      v-model="dialog_visible"
      :title="editingStationId ? '编辑场站' : '新增场站'"
      width="min(640px, 92vw)"
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
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog_visible = false">取消</el-button>
        <el-button type="primary" @click="onConfirm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑一次接线图弹窗 -->
    <el-dialog
      v-model="addDiagramVisible"
      :title="editingDiagramId ? '编辑一次接线图' : '新增一次接线图'"
      width="min(520px, 92vw)"
      destroy-on-close
    >
      <el-form
        ref="diagramFormRef"
        :model="diagramForm"
        :rules="diagramRules"
        label-width="80px"
        label-position="right"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="diagramForm.name" placeholder="请输入一次接线图名称" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="diagramForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDiagramVisible = false">取消</el-button>
        <el-button type="primary" @click="onConfirmAddDiagram">保存</el-button>
      </template>
    </el-dialog>

    <!-- 进入场站详情弹窗：上方展示场站基本信息与连接状态，下方展示一次图列表 -->
    <el-dialog
      v-model="enterVisible"
      width="min(1200px, 92vw)"
      destroy-on-close
      :close-on-click-modal="false"
      @close="onEnterDialogClose"
    >
      <template #header>
        <div class="flex items-center justify-between w-1/1 pr-20px">
          <span class="text-16px font-bold">场站详情 - {{ enterStation?.name ?? '' }}</span>
          <div class="flex items-center gap-8px">
            <el-button type="primary" size="small" :icon="Plus" @click="onAddBlankDiagram">
              新增一次图
            </el-button>
            <el-button
              type="primary"
              size="small"
              :icon="Upload"
              @click="importDiagramVisible = true"
            >
              导入一次图
            </el-button>
          </div>
        </div>
      </template>
      <div class="enter-station-info mb-14px">
        <div class="info-item">
          <span class="info-label">场站名称</span>
          <span class="info-value">{{ enterStation?.name || '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">详细地址</span>
          <span class="info-value">{{ enterStation?.address || '—' }}</span>
        </div>
      </div>

      <el-divider class="!my-10px">一次接线图列表</el-divider>

      <el-table
        :data="enterStation?.diagrams ?? []"
        border
        stripe
        max-height="360px"
        empty-text="该场站暂无一次接线图"
      >
        <el-table-column label="一次图名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name || row.id }}</template>
        </el-table-column>
        <el-table-column label="绑定设备总数" width="120" align="center" prop="boundDeviceCount" />
        <el-table-column
          label="未绑定设备数"
          width="120"
          align="center"
          prop="unboundDeviceCount"
        />
        <el-table-column label="绑定MCU" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="(row as StationDiagram).boundMcuInfo">
              {{
                (row as StationDiagram).boundMcuInfo?.sn ||
                (row as StationDiagram).boundMcuInfo?.ip ||
                (row as StationDiagram).boundMcuId
              }}
            </span>
            <span v-else style="color: #909399">未绑定</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.published ? 'success' : 'info'" size="small">
              {{ row.published ? '已发布' : '未发布' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后更新时间" width="180">
          <template #default="{ row }">{{
            row.updateTime ? formatTime(row.updateTime) : '—'
          }}</template>
        </el-table-column>
        <el-table-column label="操作" width="300" align="center" fixed="right">
          <template #default="{ row }">
            <div class="op-cell">
              <el-button text type="primary" size="small" @click="onEnterDiagram(row)"
                >打开组态</el-button
              >
              <el-button text type="primary" size="small" @click="onBindDiagramMcuClick(row)"
                >绑定MCU</el-button
              >
              <el-tooltip content="预览" placement="bottom" effect="dark">
                <el-button text type="info" size="small" @click="onPreviewDiagram(row)"
                  >预览</el-button
                >
              </el-tooltip>
              <el-tooltip content="发布" placement="bottom" effect="dark">
                <el-button
                  text
                  type="success"
                  size="small"
                  @click="emits('publishDiagram', enterStation!.id, (row as StationDiagram).id)"
                  >发布</el-button
                >
              </el-tooltip>
              <el-tooltip content="导出" placement="bottom" effect="dark">
                <el-button
                  text
                  type="warning"
                  size="small"
                  @click="emits('exportDiagram', enterStation!.id, (row as StationDiagram).id)"
                  >导出</el-button
                >
              </el-tooltip>
              <el-button
                text
                type="danger"
                size="small"
                @click="onDeleteDiagramClick(enterStation!.id, (row as StationDiagram).id)"
                >删除</el-button
              >
            </div>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="enterVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 导入一次图弹窗：选择并上传本地 JSON 文件 -->
    <el-dialog
      v-model="importDiagramVisible"
      title="导入一次图"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-upload
        ref="uploadRef"
        drag
        :auto-upload="false"
        :show-file-list="true"
        :disabled="importLoading"
        accept=".json,application/json"
        :on-change="handleImportChange"
      >
        <el-icon class="el-icon--upload"><Upload /></el-icon>
        <div class="el-upload__text">将 JSON 文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">
            仅支持本工具导出的「一次图」JSON 文件（maotu-diagram-package）
          </div>
        </template>
      </el-upload>
      <template #footer>
        <el-button :disabled="importLoading" @click="importDiagramVisible = false">取消</el-button>
      </template>
    </el-dialog>

    <!-- 绑定MCU弹窗：以表格形式列出当前场站下的 MCU，严格单选中一行后将其详细信息绑定至该一次图 -->
    <el-dialog
      v-model="bindMcuVisible"
      :title="`为一次图「${bindMcuDiagramName}」绑定MCU`"
      width="640px"
      :close-on-click-modal="false"
      @opened="onBindMcuOpened"
    >
      <el-empty
        v-if="!bindMcuOptions.length"
        description="该场站暂无可绑定的 MCU，请先在场站管理中添加 MCU"
      />
      <el-table
        v-else
        ref="bindMcuTableRef"
        :data="bindMcuOptions"
        highlight-current-row
        height="360"
        class="bind-mcu-table"
        @current-change="onBindMcuCurrentChange"
      >
        <el-table-column label="SN" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.sn || '—' }}</template>
        </el-table-column>
        <el-table-column label="IP" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.ip || '—' }}</template>
        </el-table-column>
        <el-table-column label="端口" width="90" align="center">
          <template #default="{ row }">{{ row.port || '—' }}</template>
        </el-table-column>
        <el-table-column label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '—' }}</template>
        </el-table-column>
        <el-table-column label="当前绑定" width="90" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="row.id === bindMcuDiagramBoundId"
              type="success"
              size="small"
              effect="dark"
              >已绑定</el-tag
            >
            <span v-else style="color: #c0c4cc">—</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="bindMcuVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!bindMcuOptions.length || !bindMcuSelectedId"
          @click="onConfirmBindDiagramMcu"
          >确定绑定</el-button
        >
      </template>
    </el-dialog>

    <!-- 节点右键菜单 -->
    <teleport to="body">
      <ul
        v-if="contextMenuVisible"
        class="station-aside-context-menu"
        :style="{ left: contextMenuPosition.left + 'px', top: contextMenuPosition.top + 'px' }"
        @click.stop
      >
        <li @click="onContextMenuEdit">
          <p>编辑</p>
        </li>
        <li @click="onContextMenuBindMcu">
          <p>绑定MCU</p>
        </li>
        <li @click="onContextMenuDelete">
          <p class="danger">删除</p>
        </li>
      </ul>
    </teleport>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
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
  ElMessage,
  ElScrollbar,
  ElTable,
  ElTableColumn,
  ElText,
  ElTag,
  ElDivider,
  ElUpload,
  type FormInstance,
  type FormRules,
  type UploadInstance,
  type UploadFile
} from 'element-plus';
import { Plus, Delete, Download, Upload } from '@element-plus/icons-vue';
import type { Station, StationForm, McuItem, AddDiagramPayload, StationDiagram } from './types';
import { randomString } from '@/components/mt-edit/utils';
import { useMcuDB } from '@/composables/useMcuDB';

type StationAsideProps = {
  stations: Station[];
  activeStationId?: string;
  activeDiagramId?: string;
};
const stationAsideProps = withDefaults(defineProps<StationAsideProps>(), {
  stations: () => [],
  activeStationId: '',
  activeDiagramId: ''
});
const emits = defineEmits<{
  addStation: [station: Station];
  editStation: [station: Station];
  addDiagram: [payload: AddDiagramPayload];
  editDiagram: [payload: { stationId: string; diagramId: string; name: string; remark: string }];
  loadDiagram: [stationId: string, diagramId: string];
  deleteStation: [stationId: string];
  deleteDiagram: [stationId: string, diagramId: string];
  exportStations: [];
  importStations: [file: File];
  enterStation: [stationId: string];
  publishDiagram: [stationId: string, diagramId: string];
  exportDiagram: [stationId: string, diagramId: string];
  importDiagram: [stationId: string, diagram: StationDiagram];
  previewDiagram: [stationId: string, diagram: StationDiagram];
  bindDiagramMcu: [stationId: string, diagramId: string, mcu: McuItem];
  mcuSaved: [stationId: string, mcus: McuItem[]];
}>();

const dialog_visible = ref(false);
const manageVisible = ref(false);
const editingStationId = ref<string | null>(null);
const formRef = ref<FormInstance>();
const fileInputRef = ref<HTMLInputElement>();
const active_names = ref<string[]>([]);

const isDiagramActive = (stationId: string, diagramId: string) => {
  return (
    stationAsideProps.activeStationId === stationId &&
    stationAsideProps.activeDiagramId === diagramId
  );
};

watch(
  () => stationAsideProps.activeStationId,
  (newStationId) => {
    if (newStationId && !active_names.value.includes(newStationId)) {
      active_names.value.push(newStationId);
    }
  },
  { immediate: true }
);

// 新增一次接线图弹窗相关状态
const addDiagramVisible = ref(false);
const addDiagramStationId = ref('');
const diagramFormRef = ref<FormInstance>();
const diagramForm = reactive<{ name: string; remark: string }>({
  name: '',
  remark: ''
});
const diagramRules = reactive<FormRules<{ name: string; remark: string }>>({
  name: [
    { required: true, message: '请输入一次接线图名称', trigger: 'blur' },
    // 关键修复：required 仅判断“是否非空字符串”，空格也能通过；
    // 这里在提交前再做一次去空格校验，避免存进空名称导致列表回退显示 id。
    {
      validator: (_rule, value: string, callback) => {
        if (!value || !value.trim()) {
          callback(new Error('名称不能为空或纯空格'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
});

// MCU 绑定相关状态
const mcuVisible = ref(false);
const currentStationId = ref('');
const mcuStationName = ref('');
const mcuList = ref<McuItem[]>([]);
// 打开弹窗时从统一数据库加载的快照，用于判断单行是否发生变更以刷新更新时间
let mcuSnapshot: McuItem[] = [];
// 处于编辑模式的 MCU 行 id 集合：仅集合内的行显示输入框，其余行显示纯文本
const editingIds = ref<string[]>([]);
const form = reactive<StationForm>({
  name: '',
  address: '',
  remark: ''
});
const rules = reactive<FormRules<StationForm>>({
  name: [{ required: true, message: '请输入场站名称', trigger: 'blur' }],
  address: [{ required: true, message: '请输入详细地址', trigger: 'blur' }]
});

const resetForm = () => {
  form.name = '';
  form.address = '';
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

// 导入一次图相关状态与处理
const importDiagramVisible = ref(false);
const importLoading = ref(false);
const uploadRef = ref<UploadInstance>();

const handleImportChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw;
  if (!file) {
    ElMessage.error('未获取到文件，请重新选择');
    return;
  }
  // 上传格式校验：仅允许 JSON 文件
  const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
  if (!isJson) {
    ElMessage.error('文件格式不正确，仅支持 JSON 文件');
    uploadRef.value?.clearFiles();
    return;
  }

  importLoading.value = true;
  try {
    const text = await file.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      ElMessage.error('JSON 解析失败，文件内容格式不正确');
      return;
    }
    const pkg = data as Record<string, unknown>;
    if (pkg?.type !== 'maotu-diagram-package' || !pkg?.diagram) {
      ElMessage.error('文件格式不正确，未识别为一次图导出包');
      return;
    }
    const diagram = pkg.diagram as StationDiagram;
    if (!diagram.id || typeof diagram.exportJson !== 'object' || diagram.exportJson === null) {
      ElMessage.error('一次图数据不完整，缺少必要字段（id 或 exportJson）');
      return;
    }
    // 仅做本地校验与解析，导入结果（成功/失败提示）由父组件统一处理，
    // 避免子组件抢先提示“成功”而父组件实际失败，造成提示冲突。
    if (!enterStationId.value) {
      ElMessage.error('未定位到当前场站，无法导入');
      return;
    }
    emits('importDiagram', enterStationId.value, diagram);
    importDiagramVisible.value = false;
  } catch (error) {
    console.error('导入一次图失败', error);
    ElMessage.error('导入失败，请检查文件后重试');
  } finally {
    importLoading.value = false;
    // 清空已选文件，便于再次选择同一文件
    uploadRef.value?.clearFiles();
  }
};

const onEditClick = (station: Station) => {
  editingStationId.value = station.id;
  form.name = station.name;
  form.address = station.address;
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
        remark: form.remark,
        diagrams: []
      };
      emits('addStation', new_station);
      active_names.value = [new_station.id];
    }
    dialog_visible.value = false;
  });
};

const editingDiagramId = ref<string | null>(null);

// 右键菜单相关状态与逻辑
const contextMenuVisible = ref(false);
const contextMenuPosition = reactive({ left: 0, top: 0 });
const contextMenuDiagram = ref<{ stationId: string; diagram: StationDiagram } | null>(null);

const closeContextMenu = () => {
  contextMenuVisible.value = false;
};

onMounted(() => {
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('contextmenu', closeContextMenu);
});

onUnmounted(() => {
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('contextmenu', closeContextMenu);
});

const onDiagramContextMenu = (e: MouseEvent, stationId: string, diagram: StationDiagram) => {
  e.preventDefault();
  e.stopPropagation();

  const menuWidth = 110;
  const menuHeight = 110;
  let left = e.clientX;
  let top = e.clientY;

  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 8;
  }
  if (top + menuHeight > window.innerHeight) {
    top = window.innerHeight - menuHeight - 8;
  }

  contextMenuPosition.left = left;
  contextMenuPosition.top = top;
  contextMenuDiagram.value = { stationId, diagram };
  contextMenuVisible.value = true;
};

const onContextMenuEdit = () => {
  const target = contextMenuDiagram.value;
  contextMenuVisible.value = false;
  if (!target) return;
  onLoadDiagram(target.stationId, target.diagram.id);
  onEditDiagramClick(target.stationId, target.diagram);
};

const onContextMenuBindMcu = () => {
  const target = contextMenuDiagram.value;
  contextMenuVisible.value = false;
  if (!target) return;
  onBindDiagramMcuClick(target.diagram, target.stationId);
};

const onContextMenuDelete = () => {
  const target = contextMenuDiagram.value;
  contextMenuVisible.value = false;
  if (!target) return;
  onDeleteDiagramClick(target.stationId, target.diagram.id);
};

const onAddDiagram = (stationId: string) => {
  editingDiagramId.value = null;
  addDiagramStationId.value = stationId;
  diagramForm.name = '';
  diagramForm.remark = '';
  addDiagramVisible.value = true;
};

const onEditDiagramClick = (stationId: string, diagram: StationDiagram) => {
  editingDiagramId.value = diagram.id;
  addDiagramStationId.value = stationId;
  diagramForm.name = diagram.name || '';
  diagramForm.remark = diagram.remark || '';
  addDiagramVisible.value = true;
};

// 新增一次图：与“添加”卡片逻辑完全一致——关闭场站详情弹窗后，
// 弹出“新增一次接线图”弹窗要求输入名称与备注，确认后才由父组件清空画布并开始绘制。
const onAddBlankDiagram = () => {
  const station = enterStation.value;
  if (!station) {
    ElMessage.error('未定位到当前场站，无法新增一次图');
    return;
  }
  const stationId = station.id;
  // 关闭当前弹窗（场站详情弹窗通常由“管理场站”弹窗内点击“进入场站”打开，
  // 此处一并隐藏管理弹窗，避免多层弹窗叠加残留）
  enterVisible.value = false;
  manageVisible.value = false;
  // 复用与“添加”卡片一致的“新增一次接线图”弹窗，要求先填写名称与备注
  onAddDiagram(stationId);
};

// 确认新增/编辑一次接线图：校验名称后提交给父组件持久化
const onConfirmAddDiagram = () => {
  // 先统一去空格，使后续校验与提交的值一致
  diagramForm.name = diagramForm.name.trim();
  diagramForm.remark = diagramForm.remark.trim();
  diagramFormRef.value?.validate((valid) => {
    if (!valid) {
      return;
    }
    // 兜底：即便校验被绕过，也不允许空名称入库（空名称会让列表回退显示 id）
    if (!diagramForm.name) {
      return;
    }
    if (editingDiagramId.value) {
      emits('editDiagram', {
        stationId: addDiagramStationId.value,
        diagramId: editingDiagramId.value,
        name: diagramForm.name,
        remark: diagramForm.remark
      });
    } else {
      emits('addDiagram', {
        stationId: addDiagramStationId.value,
        name: diagramForm.name,
        remark: diagramForm.remark
      });
    }
    addDiagramVisible.value = false;
  });
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

// 时间格式化：yyyy-MM-dd HH:mm:ss
const formatTime = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
};

// 校验 IPv4 地址：必须恰好 4 段，每段为 0-255 的纯数字、以点号分隔，
// 禁止字母或特殊字符；通过时返回去除前导零的标准化地址，失败时返回清晰错误信息。
const validateIPv4 = (raw: string): { ok: true; ip: string } | { ok: false; error: string } => {
  const ip = (raw || '').trim();
  if (!ip) {
    return { ok: false, error: 'IP 地址不能为空，请输入有效的 IPv4 地址' };
  }
  const segments = ip.split('.');
  if (segments.length !== 4) {
    return { ok: false, error: 'IP 地址必须由 4 段数字组成，并以点号分隔（如 192.168.1.1）' };
  }
  for (const seg of segments) {
    if (seg === '') {
      return { ok: false, error: 'IP 地址每一段都不能为空' };
    }
    if (!/^\d+$/.test(seg)) {
      return { ok: false, error: 'IP 地址每段只能包含数字，不能包含字母或特殊字符' };
    }
    const num = Number(seg);
    if (num < 0 || num > 255) {
      return { ok: false, error: 'IP 地址每一段的数值必须在 0-255 之间' };
    }
  }
  // 标准化：去除每段前导零（如 01 -> 1），拼接为规范形式
  const normalized = segments.map((s) => String(Number(s))).join('.');
  return { ok: true, ip: normalized };
};

// 打开“绑定MCU”弹窗，加载该场站已绑定的 MCU 列表
const onBindMcuClick = async (row: Station) => {
  currentStationId.value = row.id;
  mcuStationName.value = row.name;
  const db = useMcuDB();
  mcuSnapshot = await db.loadByStation(row.id);
  mcuList.value = mcuSnapshot.map((m) => ({ ...m }));
  // 默认以纯文本模式展示，清空编辑态
  editingIds.value = [];
  mcuVisible.value = true;
};

// 进入场站：打开该场站详情弹窗（展示场站信息与一次图列表）
const onEnterStationClick = (row: Station) => {
  enterStationId.value = row.id;
  enterVisible.value = true;
};

// 进入场站详情弹窗相关状态
const enterVisible = ref(false);
// 仅保存场站 id，enterStation 通过 computed 始终从真实 stations 列表派生，
// 保证父组件更新 stations 后详情弹窗中的一次图列表能实时渲染。
const enterStationId = ref<string | null>(null);
const enterStation = computed(
  () => stationAsideProps.stations.find((s) => s.id === enterStationId.value) ?? null
);

// 弹窗关闭：重置详情弹窗的场站上下文。
// 说明：场站详情不再展示连接状态——连接信息（SN / IP / 端口）已下沉到 MCU 实体，
// 场站本身不再持有 IP，原基于场站 IP 的连接探测逻辑已移除。
const onEnterDialogClose = () => {
  enterStationId.value = null;
};

// 在详情弹窗中进入指定一次图：加载该图到编辑区，并同步关闭上层的“管理场站”弹窗
const onEnterDiagram = (diagram: StationDiagram) => {
  if (!enterStation.value) return;
  emits('loadDiagram', enterStation.value.id, diagram.id);
  enterVisible.value = false;
  // 进入场站时由“管理场站”弹窗打开了详情弹窗，加载图后需同步隐藏管理弹窗，避免多层弹窗叠加
  manageVisible.value = false;
};

// 预览一次图：复用现有“预览”按钮的逻辑，不再弹出独立弹窗。
// 直接把该行一次图透传给父组件，由父组件走与顶部“预览”按钮完全相同的
// 预览流程（注入实时数据后在新标签页打开预览页面）。
const onPreviewDiagram = (diagram: StationDiagram) => {
  if (!enterStation.value) return;
  emits('previewDiagram', enterStation.value.id, diagram);
};

// 绑定MCU弹窗相关状态：为单个一次图选择所属场站下的一个 MCU 进行绑定
const bindMcuVisible = ref(false);
const bindMcuDiagramName = ref('');
const bindMcuDiagramId = ref('');
const bindMcuDiagramStationId = ref('');
// 记录该一次图当前已绑定的 MCU（用于表格中高亮「已绑定」标记）；与 bindMcuSelectedId 区分开：
// selected 为本次弹窗内的待绑定选择，boundId 为最初打开时已有的绑定，便于用户取消已绑定关系时对比
const bindMcuDiagramBoundId = ref('');
const bindMcuOptions = ref<McuItem[]>([]);
const bindMcuSelectedId = ref('');
const bindMcuTableRef = ref<InstanceType<typeof ElTable> | null>(null);

// 点击「绑定MCU」：拉取当前场站下的 MCU 列表，弹窗供用户选择
const onBindDiagramMcuClick = async (diagram: StationDiagram, targetStationId?: string) => {
  const stId = targetStationId || enterStation.value?.id;
  if (!stId) {
    ElMessage.error('未定位到当前场站，无法绑定MCU');
    return;
  }
  bindMcuDiagramStationId.value = stId;
  bindMcuDiagramId.value = diagram.id;
  bindMcuDiagramName.value = diagram.name || diagram.id;
  // 记录该图当前已绑定的 MCU，用于展示「已绑定」标记
  bindMcuDiagramBoundId.value = diagram.boundMcuId || '';
  // 默认回显该图已绑定的 MCU（严格单选，初始至多一个选中项）
  bindMcuSelectedId.value = diagram.boundMcuId || '';
  try {
    const db = useMcuDB();
    bindMcuOptions.value = await db.loadByStation(stId);
  } catch (e) {
    bindMcuOptions.value = [];
    ElMessage.error('获取MCU列表失败，请重试');
    return;
  }
  bindMcuVisible.value = true;
};

// 弹窗完全打开后，将已绑定的 MCU 行设为表格高亮（仅选中一行，保证严格单选）
const onBindMcuOpened = () => {
  const table = bindMcuTableRef.value;
  if (!table) return;
  const current = bindMcuOptions.value.find((m) => m.id === bindMcuSelectedId.value) || null;
  table.setCurrentRow(current);
};

// 表格严格单选：当前行切换时更新待绑定选择，highlight-current-row 保证同一时间只有一行被选中
const onBindMcuCurrentChange = (row: McuItem | null) => {
  bindMcuSelectedId.value = row ? row.id : '';
};

// 确认绑定：把选中的 MCU 详细信息绑定至目标一次图，交由父组件持久化
const onConfirmBindDiagramMcu = () => {
  const stId = bindMcuDiagramStationId.value || enterStation.value?.id;
  if (!stId) return;
  const mcu = bindMcuOptions.value.find((m) => m.id === bindMcuSelectedId.value);
  if (!mcu) {
    ElMessage.warning('请选择要绑定的 MCU');
    return;
  }
  emits('bindDiagramMcu', stId, bindMcuDiagramId.value, { ...mcu });
  bindMcuVisible.value = false;
};

// 新增一行可编辑的 MCU（SN 号留空，待保存时校验必填），新增行直接进入编辑模式
const onAddMcuRow = () => {
  const id = 'mcu-' + randomString();
  mcuList.value.push({
    id,
    stationId: currentStationId.value,
    sn: '',
    ip: '',
    port: '',
    remark: '',
    updateTime: 0
  });
  // 新增行默认显示输入框
  editingIds.value = [...editingIds.value, id];
};

// 删除一行 MCU（仅从当前列表移除，保存时统一持久化）
const onRemoveMcuRow = (index: number) => {
  const removed = mcuList.value[index];
  if (removed) {
    editingIds.value = editingIds.value.filter((x) => x !== removed.id);
  }
  mcuList.value.splice(index, 1);
};

// 进入单行的编辑模式：该行切换为输入框
const onEditMcuRow = (id: string) => {
  if (!editingIds.value.includes(id)) {
    editingIds.value = [...editingIds.value, id];
  }
};

// 退出单行的编辑模式：该行立即恢复为纯文本显示
const onFinishMcuRow = (id: string) => {
  editingIds.value = editingIds.value.filter((x) => x !== id);
};

// 保存 MCU 绑定：校验 SN 必填、IP 为合法 IPv4，每次成功保存自动以当前系统时间刷新更新时间，并持久化到统一数据库
const onSaveMcu = async () => {
  const now = Date.now();
  const items: McuItem[] = [];
  for (const m of mcuList.value) {
    const sn = (m.sn || '').trim();
    if (!sn) {
      ElMessage.warning('SN号为必填项，请填写完整后再保存');
      return;
    }
    const ipRaw = (m.ip || '').trim();
    const ipResult = validateIPv4(ipRaw);
    if (!ipResult.ok) {
      ElMessage.warning(`MCU（SN：${sn}）的${ipResult.error}`);
      return;
    }
    const ip = ipResult.ip;
    const port = (m.port || '').trim();
    const remark = (m.remark || '').trim();
    items.push({
      id: m.id,
      stationId: currentStationId.value,
      sn,
      ip,
      port,
      remark,
      // 每次成功保存即捕获当前系统时间，准确反映最后一次编辑完成时间
      updateTime: now
    });
  }
  const db = useMcuDB();
  try {
    await db.replaceByStation(currentStationId.value, items);
    mcuSnapshot = items.map((m) => ({ ...m }));
    emits(
      'mcuSaved',
      currentStationId.value,
      items.map((m) => ({ ...m }))
    );
    ElMessage.success('MCU绑定信息已保存');
    mcuVisible.value = false;
  } catch (e) {
    ElMessage.error('保存MCU绑定失败，请重试');
  }
};
</script>
<style scoped>
:deep(.el-button--small) {
  padding: 6px;
}
#mt-station-aside :deep(.el-collapse-item__header),
#mt-station-aside :deep(.el-collapse-item__wrap) {
  background-color: transparent !important;
}

.enter-station-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 24px;
}
.info-item {
  display: flex;
  align-items: baseline;
  font-size: 14px;
  line-height: 1.5;
}
.info-label {
  flex: none;
  width: 76px;
  color: #909399;
}
.info-value {
  color: #303133;
  word-break: break-all;
}

.bind-mcu-table {
  width: 100%;
}
.bind-mcu-table :deep(.el-table__row) {
  cursor: pointer;
}

.op-cell {
  display: flex;
  /* flex-wrap: wrap; */
  justify-content: center;
  gap: 0px;
}
.op-cell .el-button {
  margin: 0;
}

.station-aside-context-menu {
  position: fixed;
  z-index: 99999;
  background: #ffffff;
  padding: 5px 0;
  margin: 0;
  display: block;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 100px;
  border: 1px solid #e4e7ed;
}

.station-aside-context-menu li {
  list-style: none;
  padding: 0;
  margin: 0;
}

.station-aside-context-menu p {
  text-decoration: none;
  display: block;
  padding: 6px 18px;
  margin: 0;
  font-size: 13px;
  color: #606266;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.station-aside-context-menu p:hover {
  background-color: #ecf5ff;
  color: #409eff;
}

.station-aside-context-menu p.danger:hover {
  background-color: #fef0f0;
  color: #f56c6c;
}
</style>
