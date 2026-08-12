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
  let export_done_json: IExportDoneJson[] = [];
  export_done_json = objectDeepClone<IDoneJson[]>(doneJson).map((m) => {
    if (m.symbol) {
      delete m.symbol;
    }
    let new_props = {};
    for (const key in m.props) {
      new_props = { ...new_props, ...{ [key]: m.props[key].val } };
    }
    return {
      ...m,
      props: new_props,
      active: false
    };
  });
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
  const importedItems: IDoneJson[] = json.json.map((m) => {
    let props: ILeftAsideConfigItemPublicProps = {};
    let symbol = undefined;
    // 找到原始的props
    const find_item = init_configs.find((f) => f?.id == m.tag);
    const find_props = find_item?.props;
    if (find_props) {
      props = { ...props, ...objectDeepClone(find_props) };
    }
    for (const key in m.props) {
      if (props[key]) {
        props[key].val = m.props[key];
      }
    }
    if (find_item?.symbol) {
      symbol = find_item.symbol;
    }
    return {
      ...m,
      props,
      symbol
    };
  });
  // 旧数据没有缩放基准时，禁止在当前尺寸上继续缩小；放大后仍可缩回该尺寸。
  const importDoneJson = normalizeResizeBaseSizes(importedItems, true);
  return {
    canvasCfg: json.canvasCfg,
    gridCfg: json.gridCfg,
    importDoneJson
  };
};
