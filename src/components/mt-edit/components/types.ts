import type { IDoneJson, IGlobalStoreCanvasCfg, IGlobalStoreGridCfg } from '../store/types';

export type MouseTouchEvent = MouseEvent | TouchEvent;
export interface ISvgAsset {
  encoding: 'base64';
  format: 'svg-symbol';
  contentBase64: string;
  symbolId: string;
  width: string;
  height: string;
}
export interface IExportDoneJson extends Omit<IDoneJson, 'props' | 'symbol' | 'children'> {
  props: {
    [key: string]: any;
  };
  children?: IExportDoneJson[];
  svgAssetId?: string;
}
export interface IExportJson {
  canvasCfg: IGlobalStoreCanvasCfg;
  gridCfg: IGlobalStoreGridCfg;
  json: IExportDoneJson[];
  /** 仅发布包使用；旧数据不包含时由消费端继续走本地图元库 */
  assetBundleVersion?: 1;
  /** 当前一次图实际使用的 SVG 图元，按 svgAssetId 去重 */
  svgAssets?: Record<string, ISvgAsset>;
}
