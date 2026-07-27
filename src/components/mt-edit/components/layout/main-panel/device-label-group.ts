import type { IDoneJson } from '@/components/mt-edit/store/types';
import { buildGroupFromItems } from '@/components/mt-edit/composables/template-builder';

/** 将设备图元和名称标签组成默认设备组合。 */
export const buildDeviceLabelGroup = (deviceItem: IDoneJson, labelItem: IDoneJson): IDoneJson => {
  const group = buildGroupFromItems([deviceItem, labelItem]);
  if (!group?.children?.length) {
    throw new Error('创建设备名称组合失败');
  }

  const deviceChild = group.children[0];
  group.title = deviceItem.title;
  group.device = true;
  group.deviceBind = deviceChild.deviceBind;
  group.deviceLabelGroup = true;

  // 设备身份由顶层组合承担，避免统计时同时计入组合和子图元。
  deviceChild.device = false;
  deviceChild.deviceBind = undefined;

  return group;
};

/** 取消默认设备组合时，把设备身份和绑定信息还原给第一个子图元。 */
export const restoreDeviceFromLabelGroup = (
  group: IDoneJson,
  splitItems: IDoneJson[]
): IDoneJson[] => {
  if (!group.deviceLabelGroup || splitItems.length === 0) {
    return splitItems;
  }

  const [deviceItem, ...otherItems] = splitItems;
  return [
    {
      ...deviceItem,
      device: true,
      deviceBind: group.deviceBind
    },
    ...otherItems
  ];
};
