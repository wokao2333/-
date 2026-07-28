import {
  PUBLISH_SVG_SINGLE_ASSET_LIMIT,
  validateSymbol
} from '@/components/mt-edit/composables/publish-assets';
import type { ILeftAsideConfigItemPrivateSymbol } from '@/components/mt-edit/store/types';
import { svgToImgSrc, svgToSymbol } from './index';

export const UPLOAD_SVG_MAX_BYTES = PUBLISH_SVG_SINGLE_ASSET_LIMIT;

export interface ParsedUploadedSvg {
  svg: string;
  symbol: ILeftAsideConfigItemPrivateSymbol;
  thumbnail: string;
}

export class SvgUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SvgUploadError';
  }
}

const getUtf8ByteLength = (value: string) => new TextEncoder().encode(value).byteLength;

/**
 * 解析并校验用户上传的 SVG。先序列化根节点去掉 XML/DOCTYPE 外壳，
 * 再复用发布阶段的 symbol 安全校验，确保上传后能够正常拖入和发布。
 */
export function parseUploadedSvg(source: string, symbolId: string): ParsedUploadedSvg {
  if (!source.trim()) {
    throw new SvgUploadError('SVG 文件内容为空');
  }
  if (getUtf8ByteLength(source) > UPLOAD_SVG_MAX_BYTES) {
    throw new SvgUploadError(`SVG 文件不能超过 ${UPLOAD_SVG_MAX_BYTES / 1024} KiB`);
  }

  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;
  if (!root || root.localName.toLowerCase() === 'parsererror') {
    throw new SvgUploadError('不是合法的 SVG XML');
  }
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new SvgUploadError('不是合法的 SVG XML');
  }
  if (root.localName.toLowerCase() !== 'svg') {
    throw new SvgUploadError('根元素必须是 <svg>');
  }
  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  // 不保存 XML 声明、DOCTYPE 和根节点外的注释，兼容项目现有 SVG 的 viewBox/style 写法。
  const normalizedSvg = new XMLSerializer().serializeToString(root);
  const symbol = {
    symbol_id: symbolId,
    ...svgToSymbol(normalizedSvg, symbolId, { preserveAppearance: true })
  };
  const issues = validateSymbol(symbol);
  if (issues.length > 0) {
    throw new SvgUploadError(issues.join('；'));
  }
  if (getUtf8ByteLength(symbol.symbol_str) > UPLOAD_SVG_MAX_BYTES) {
    throw new SvgUploadError(`SVG 图元内容不能超过 ${UPLOAD_SVG_MAX_BYTES / 1024} KiB`);
  }

  return {
    svg: normalizedSvg,
    symbol,
    thumbnail: svgToImgSrc(normalizedSvg)
  };
}
