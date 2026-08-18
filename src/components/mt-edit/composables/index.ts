import type { IExportDoneJson, IExportJson } from '../components/types';
import { leftAsideStore } from '../store/left-aside';
import type {
  IDoneJson,
  IGlobalStoreCanvasCfg,
  IGlobalStoreGridCfg,
  ILeftAsideConfigItem,
  ILeftAsideConfigItemPublicProps
} from '../store/types';
import { objectDeepClone } from '../utils';
import { normalizeResizeBaseSizes } from '@/components/mt-dzr/resize-constraints';

export const genExportJson = (
  canvasCfg: IGlobalStoreCanvasCfg,
  gridCfg: IGlobalStoreGridCfg,
  doneJson: IDoneJson[]
) => {
  const toExportItem = (item: IDoneJson): IExportDoneJson => {
    const { symbol: _symbol, children, props, ...rest } = item;
    const exportProps = Object.entries(props).reduce<Record<string, unknown>>(
      (result, [key, prop]) => {
        result[key] = prop.val;
        return result;
      },
      {}
    );

    return {
      ...rest,
      props: exportProps,
      active: false,
      ...(Array.isArray(children) ? { children: children.map(toExportItem) } : {})
    };
  };

  // group 的子图元也必须转成发布 JSON；否则组合内元素仍保留编辑态 props，
  // 微电网与本地恢复会走到两套不同的数据结构。
  const export_done_json = objectDeepClone<IDoneJson[]>(doneJson).map(toExportItem);
  const exportJson: IExportJson = {
    canvasCfg,
    gridCfg,
    json: export_done_json
  };
  return { exportJson };
};
export const useExportJsonToDoneJson = (json: IExportJson) => {
  // 取出所有图形的初始配置
  let init_configs: ILeftAsideConfigItem[] = [];
  for (const iterator of leftAsideStore.config.values()) {
    if (iterator.length > 0) {
      init_configs = [...init_configs, ...iterator];
    }
  }
  const getExportPropValue = (value: unknown) =>
    value && typeof value === 'object' && 'val' in value ? (value as { val: unknown }).val : value;
  const toDoneItem = (item: IExportDoneJson): IDoneJson => {
    let props: ILeftAsideConfigItemPublicProps = {};
    let symbol = undefined;
    // 找到原始的props
    const find_item = init_configs.find((f) => f?.id == item.tag);
    const find_props = find_item?.props;
    if (find_props) {
      props = { ...props, ...objectDeepClone(find_props) };
    }
    for (const key in item.props) {
      const value = getExportPropValue(item.props[key]);
      if (props[key]) {
        props[key].val = value;
      } else {
        props[key] = {
          title: key,
          type: 'input',
          val: value
        };
      }
    }
    if (find_item?.symbol) {
      symbol = find_item.symbol;
    }
    return {
      ...item,
      props,
      symbol,
      ...(Array.isArray(item.children) ? { children: item.children.map(toDoneItem) } : {})
    };
  };
  const importedItems = json.json.map(toDoneItem);
  // 旧数据没有缩放基准时，禁止在当前尺寸上继续缩小；放大后仍可缩回该尺寸。
  const importDoneJson = normalizeResizeBaseSizes(importedItems, true);
  return {
    canvasCfg: json.canvasCfg,
    gridCfg: json.gridCfg,
    importDoneJson
  };
};
