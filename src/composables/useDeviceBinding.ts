import type { IExportJson } from '@/components/mt-edit/components/types';

export interface DeviceInfo {
  id: string;
  name: string;
}

export interface DeviceField {
  key: string;
  name: string;
  unit: string;
}

export interface DeviceBindInfo {
  deviceId: string;
  dataKey: string;
  targetAttr: string;
  unit: string;
  nameTargetAttr?: string;
  fieldName?: string;
}

export interface DeviceApiConfig {
  deviceListUrl: string;
  deviceListPath: string;
  deviceIdPath: string;
  deviceNamePath: string;
  fieldListUrl: string;
  fieldListPath: string;
  fieldKeyPath: string;
  fieldNamePath: string;
  fieldUnitPath: string;
  realtimeUrl: string;
  realtimeDataPath: string;
  refreshInterval: number;
}

export type DeviceBindingExportJson = IExportJson & {
  deviceApiConfig?: DeviceApiConfig;
};

export interface DeviceBindableItem {
  id: string;
  title?: string;
  tag?: string;
  deviceBind?: DeviceBindInfo;
}

export interface DeviceTargetOption {
  label: string;
  value: string;
  tags: string[];
}

export interface DeviceRealtimeResponse {
  code: number;
  message: string;
  data: Record<string, Record<string, unknown>>;
  unknownIds: string[];
  updatedAt: string;
}

export interface DeviceBindingRecord {
  itemId: string;
  itemTitle?: string;
  bind: DeviceBindInfo;
}

export const deviceApiConfigStorageKey = 'maotu-device-api-config';

export const defaultDeviceApiConfig: DeviceApiConfig = {
  deviceListUrl: '/api/devices',
  deviceListPath: '',
  deviceIdPath: 'id',
  deviceNamePath: 'name',
  fieldListUrl: '/api/device/fields',
  fieldListPath: '',
  fieldKeyPath: 'key',
  fieldNamePath: 'name',
  fieldUnitPath: 'unit',
  realtimeUrl: '/api/device/realtime?ids={ids}',
  realtimeDataPath: 'data',
  refreshInterval: 5000
};

export const deviceTargetOptions: DeviceTargetOption[] = [
  {
    label: '文本内容',
    value: 'props.text.val',
    tags: ['text-vue', 'sys-button-vue']
  },
  {
    label: '键值对-值',
    value: 'props.value.val',
    tags: ['kv-vue']
  }
];

export const deviceNameTargetOptions: DeviceTargetOption[] = [
  {
    label: '键值对-键名',
    value: 'props.label.val',
    tags: ['kv-vue']
  }
];

export const normalizeDeviceApiConfig = (
  config?: Partial<DeviceApiConfig> | null
): DeviceApiConfig => ({
  ...defaultDeviceApiConfig,
  ...(config || {}),
  refreshInterval: Number(config?.refreshInterval || defaultDeviceApiConfig.refreshInterval)
});

export const loadDeviceApiConfig = () => {
  if (typeof localStorage === 'undefined') {
    return normalizeDeviceApiConfig();
  }

  try {
    const raw = localStorage.getItem(deviceApiConfigStorageKey);
    return normalizeDeviceApiConfig(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.error(error);
    return normalizeDeviceApiConfig();
  }
};

export const saveDeviceApiConfig = (config: DeviceApiConfig) => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(deviceApiConfigStorageKey, JSON.stringify(normalizeDeviceApiConfig(config)));
};

export const resetDeviceApiConfig = () => normalizeDeviceApiConfig();

export const attachDeviceApiConfig = (
  exportJson: IExportJson,
  config: DeviceApiConfig
): DeviceBindingExportJson => ({
  ...exportJson,
  deviceApiConfig: normalizeDeviceApiConfig(config)
});

const readJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} 请求失败: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const toPathSegments = (path: string) => {
  return path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const getValueByPath = (source: unknown, path: string) => {
  if (!path) {
    return source;
  }

  return toPathSegments(path).reduce<unknown>((result, key) => {
    if (result && typeof result === 'object' && key in result) {
      return (result as Record<string, unknown>)[key];
    }

    return undefined;
  }, source);
};

export const setValueByPath = (source: unknown, path: string, value: unknown) => {
  if (!source || typeof source !== 'object' || !path) {
    return false;
  }

  const segments = toPathSegments(path);
  const lastKey = segments.pop();

  if (!lastKey) {
    return false;
  }

  const target = segments.reduce<unknown>((result, key) => {
    if (result && typeof result === 'object' && key in result) {
      return (result as Record<string, unknown>)[key];
    }

    return undefined;
  }, source);

  if (!target || typeof target !== 'object') {
    return false;
  }

  (target as Record<string, unknown>)[lastKey] = value;
  return true;
};

const valueToString = (value: unknown, fallback = '') => {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
};

const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => {
      return !!item && typeof item === 'object';
    });
  }

  if (value && typeof value === 'object') {
    return Object.values(value).filter((item): item is Record<string, unknown> => {
      return !!item && typeof item === 'object';
    });
  }

  return [];
};

export const resolveApiUrl = (urlTemplate: string, params: Record<string, string | number>) => {
  return Object.entries(params).reduce((url, [key, value]) => {
    return url.replaceAll(`{${key}}`, encodeURIComponent(String(value)));
  }, urlTemplate);
};

export const fetchDevices = async (configInput?: Partial<DeviceApiConfig>) => {
  const config = normalizeDeviceApiConfig(configInput);
  const response = await readJson<unknown>(config.deviceListUrl);
  const list = toRecordList(getValueByPath(response, config.deviceListPath));

  return list
    .map((item, index) => {
      const id = valueToString(getValueByPath(item, config.deviceIdPath));

      return {
        id,
        name: valueToString(getValueByPath(item, config.deviceNamePath)) || id || `设备${index + 1}`
      };
    })
    .filter((item) => item.id);
};

export const fetchDeviceFields = async (configInput?: Partial<DeviceApiConfig>, deviceId = '') => {
  const config = normalizeDeviceApiConfig(configInput);
  const fieldUrl = resolveApiUrl(config.fieldListUrl, {
    deviceId,
    ids: deviceId
  });
  const response = await readJson<unknown>(fieldUrl);
  const list = toRecordList(getValueByPath(response, config.fieldListPath));

  return list
    .map((item) => {
      const key = valueToString(getValueByPath(item, config.fieldKeyPath));

      return {
        key,
        name: valueToString(getValueByPath(item, config.fieldNamePath), key),
        unit: valueToString(getValueByPath(item, config.fieldUnitPath))
      };
    })
    .filter((item) => item.key);
};

const pickDeviceId = (item: Record<string, unknown>) => {
  return valueToString(item.id || item.deviceId || item.device_id);
};

const normalizeRealtimeData = (source: unknown, deviceIds: string[]) => {
  const data: Record<string, Record<string, unknown>> = {};

  if (Array.isArray(source)) {
    source.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const record = item as Record<string, unknown>;
      const deviceId = pickDeviceId(record);

      if (deviceId) {
        data[deviceId] = record;
      }
    });

    return data;
  }

  if (!source || typeof source !== 'object') {
    return data;
  }

  const record = source as Record<string, unknown>;
  const isDeviceMap = deviceIds.some((deviceId) => {
    return record[deviceId] && typeof record[deviceId] === 'object';
  });

  if (isDeviceMap) {
    deviceIds.forEach((deviceId) => {
      const deviceData = record[deviceId];

      if (deviceData && typeof deviceData === 'object') {
        data[deviceId] = deviceData as Record<string, unknown>;
      }
    });

    return data;
  }

  if (deviceIds.length === 1) {
    data[deviceIds[0]] = record;
  }

  return data;
};

export const fetchDeviceRealtime = async (
  configInput: Partial<DeviceApiConfig> | undefined,
  deviceIds: string[]
): Promise<DeviceRealtimeResponse> => {
  const config = normalizeDeviceApiConfig(configInput);
  const ids = [...new Set(deviceIds)].filter(Boolean);
  const url = resolveApiUrl(config.realtimeUrl, {
    ids: ids.join(','),
    deviceId: ids[0] || ''
  });
  const response = await readJson<unknown>(url);
  const realtimeSource = getValueByPath(response, config.realtimeDataPath);
  const data = normalizeRealtimeData(realtimeSource, ids);

  return {
    code: Number(getValueByPath(response, 'code') ?? 0),
    message: valueToString(getValueByPath(response, 'message'), 'ok'),
    data,
    unknownIds: ids.filter((id) => !data[id]),
    updatedAt: valueToString(getValueByPath(response, 'updatedAt'), new Date().toISOString())
  };
};

export const getDeviceTargetOptions = (item: DeviceBindableItem) => {
  return deviceTargetOptions.filter((option) => option.tags.includes(item.tag || ''));
};

export const canBindDeviceValue = (item: DeviceBindableItem) => {
  return getDeviceTargetOptions(item).length > 0;
};

export const getDeviceNameTargetOptions = (item: DeviceBindableItem) => {
  return deviceNameTargetOptions.filter((option) => option.tags.includes(item.tag || ''));
};

const getDefaultTargetAttr = (item: DeviceBindableItem) => {
  const [firstOption] = getDeviceTargetOptions(item);
  return firstOption?.value || '';
};

const getDefaultNameTargetAttr = (item: DeviceBindableItem) => {
  const [firstOption] = getDeviceNameTargetOptions(item);
  return firstOption?.value || '';
};

export const ensureDeviceBind = (item: DeviceBindableItem) => {
  if (!item.deviceBind) {
    item.deviceBind = {
      deviceId: '',
      dataKey: '',
      targetAttr: getDefaultTargetAttr(item),
      nameTargetAttr: getDefaultNameTargetAttr(item),
      unit: ''
    };
  }

  if (!item.deviceBind.targetAttr) {
    item.deviceBind.targetAttr = getDefaultTargetAttr(item);
  }

  if (!item.deviceBind.nameTargetAttr) {
    item.deviceBind.nameTargetAttr = getDefaultNameTargetAttr(item);
  }

  return item.deviceBind;
};

export const syncDeviceFieldMeta = (bind: DeviceBindInfo, fields: DeviceField[]) => {
  const field = fields.find((item) => item.key === bind.dataKey);

  bind.fieldName = field?.name || '';
  bind.unit = field?.unit || '';
};

export const collectDeviceBindings = (
  exportJson: IExportJson | DeviceBindingExportJson
): DeviceBindingRecord[] => {
  return exportJson.json.flatMap((item) => {
    const bind = (item as DeviceBindableItem).deviceBind;

    if (!bind?.deviceId || !bind.dataKey || !bind.targetAttr) {
      return [];
    }

    return [
      {
        itemId: item.id,
        itemTitle: item.title,
        bind
      }
    ];
  });
};

export const formatDeviceValue = (value: unknown, unit = '') => {
  if (value === null || value === undefined) {
    return '';
  }

  return `${value}${unit}`;
};

/** 后端返回的设备数据项 */
export interface BackendDeviceItem {
  deviceType: number;
  deviceTypeName: string;
  deviceId: string;
  deviceName: string;
  points: { code: string; name: string }[];
}

/** 后端返回的完整 JSON 结构 */
export interface BackendDeviceResponse {
  code: number;
  msg: string;
  data: BackendDeviceItem[];
}

/** 解析结果 */
export interface ParsedDeviceBindingData {
  devices: DeviceInfo[];
  /** 按 deviceId 分组的字段映射 */
  fieldsMap: Record<string, DeviceField[]>;
}

/**
 * 解析后端返回的设备绑定 JSON 数据
 * 从 data 数组中提取设备列表和每个设备的点位（属性）列表
 */
export const parseDeviceBindingData = (raw: unknown): ParsedDeviceBindingData => {
  const response = raw as BackendDeviceResponse;

  if (!response || response.code !== 200 || !Array.isArray(response.data)) {
    throw new Error('JSON 格式不正确：缺少 code=200 或 data 数组');
  }

  const devices: DeviceInfo[] = [];
  const fieldsMap: Record<string, DeviceField[]> = {};

  for (const item of response.data) {
    if (!item.deviceId) continue;

    devices.push({
      id: item.deviceId,
      name: item.deviceName || item.deviceId
    });

    const fields: DeviceField[] = (item.points || []).map((point) => ({
      key: point.code,
      name: point.name || point.code,
      unit: ''
    }));

    // 合并同名设备的点位（去重）
    if (fieldsMap[item.deviceId]) {
      const existingKeys = new Set(fieldsMap[item.deviceId].map((f) => f.key));
      for (const field of fields) {
        if (!existingKeys.has(field.key)) {
          fieldsMap[item.deviceId].push(field);
        }
      }
    } else {
      fieldsMap[item.deviceId] = fields;
    }
  }

  return { devices, fieldsMap };
};
