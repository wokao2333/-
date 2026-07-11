import type { IExportJson, ISvgAsset } from '../components/types';
import type { ILeftAsideConfig, ILeftAsideConfigItemPrivateSymbol } from '../store/types';

export const PUBLISH_SVG_SINGLE_ASSET_LIMIT = 256 * 1024;
export const PUBLISH_SVG_BUNDLE_BASE64_LIMIT = 1024 * 1024;

interface PublishSvgNode {
  id?: string;
  title?: string;
  type?: string;
  tag?: string;
  svgAssetId?: string;
  symbol?: ILeftAsideConfigItemPrivateSymbol;
  children?: PublishSvgNode[];
  [key: string]: unknown;
}

export interface BuildPublishAssetsOptions {
  leftAsideConfig: ILeftAsideConfig;
  singleAssetDecodedLimit?: number;
  bundleBase64Limit?: number;
}

export class PublishAssetsError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`SVG 图元发布校验失败：${issues.join('；')}`);
    this.name = 'PublishAssetsError';
    this.issues = issues;
  }
}

const getUtf8Bytes = (value: string) => new TextEncoder().encode(value);

export const encodeUtf8Base64 = (value: string): string => {
  const bytes = getUtf8Bytes(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

export const decodeUtf8Base64 = (value: string): string => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

const findExternalUrl = (value: string): string | null => {
  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(value))) {
    const target = match[2].trim();
    if (target && !target.startsWith('#')) {
      return target;
    }
  }
  return null;
};

const unsafeExpressionPattern = /javascript\s*:|expression\s*\(/i;
const svgDimensionPattern = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|pt|pc|mm|cm|in|em|ex|%)?$/i;
const maxSvgDimension = 1_000_000;
const maxIdentifierLength = 256;
const blockedElementNames = new Set([
  'script',
  'foreignobject',
  'metadata',
  'iframe',
  'object',
  'embed',
  'link',
  'base',
  'audio',
  'video',
  'animate',
  'animatemotion',
  'animatetransform',
  'set'
]);

const hasControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
  });

const validateIdentifier = (value: unknown, fieldName: string): string | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return `${fieldName} 不能为空`;
  }
  if (value.length > maxIdentifierLength) {
    return `${fieldName} 长度不能超过 ${maxIdentifierLength}`;
  }
  if (hasControlCharacter(value)) {
    return `${fieldName} 不能包含控制字符`;
  }
  return null;
};

const validateDimension = (value: unknown, fieldName: string): string | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 && value <= maxSvgDimension
      ? null
      : `${fieldName} 必须是大于 0 且不超过 ${maxSvgDimension} 的有限数值`;
  }
  if (typeof value !== 'string' || !svgDimensionPattern.test(value.trim())) {
    return `${fieldName} 不是合法的 SVG 尺寸`;
  }
  const numericValue = Number.parseFloat(value);
  return Number.isFinite(numericValue) && numericValue > 0 && numericValue <= maxSvgDimension
    ? null
    : `${fieldName} 必须大于 0 且不超过 ${maxSvgDimension}`;
};

const validateSymbol = (symbol: ILeftAsideConfigItemPrivateSymbol): string[] => {
  const issues: string[] = [];
  const source = symbol.symbol_str;

  if (
    /<!DOCTYPE\b/i.test(source) ||
    /<!ENTITY\b/i.test(source) ||
    /<\?xml-stylesheet\b/i.test(source)
  ) {
    issues.push('包含不允许的 DOCTYPE/ENTITY/xml-stylesheet 声明');
  }

  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;
  if (!root || root.localName.toLowerCase() === 'parsererror') {
    issues.push('不是合法的 SVG XML');
    return issues;
  }
  if (document.getElementsByTagName('parsererror').length > 0) {
    issues.push('不是合法的 SVG XML');
    return issues;
  }
  if (root.localName.toLowerCase() !== 'symbol') {
    issues.push('根元素必须是 <symbol>');
  }

  const rootId = root.getAttribute('id');
  const symbolIdIssue = validateIdentifier(symbol.symbol_id, 'symbolId');
  if (symbolIdIssue) {
    issues.push(symbolIdIssue);
  }
  if (!symbol.symbol_id || !rootId || rootId !== symbol.symbol_id) {
    issues.push('symbolId 与 <symbol id> 不一致');
  }
  const widthIssue = validateDimension(symbol.width, 'width');
  if (widthIssue) {
    issues.push(widthIssue);
  }
  const heightIssue = validateDimension(symbol.height, 'height');
  if (heightIssue) {
    issues.push(heightIssue);
  }

  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    const tagName = element.localName.toLowerCase();
    if (blockedElementNames.has(tagName)) {
      issues.push(`包含不允许的 <${element.localName}> 元素`);
    }

    if (tagName === 'style') {
      const cssText = element.textContent ?? '';
      if (/@import\b/i.test(cssText)) {
        issues.push('<style> 中包含不允许的 @import');
      }
      if (unsafeExpressionPattern.test(cssText)) {
        issues.push('<style> 中包含不允许的脚本或 expression()');
      }
      const externalStyleUrl = findExternalUrl(cssText);
      if (externalStyleUrl) {
        issues.push(`<style> 中包含外链资源 ${externalStyleUrl}`);
      }
    }

    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase();
      const localName = attribute.localName.toLowerCase();
      const value = attribute.value.trim();
      const isNamespaceDeclaration =
        attributeName === 'xmlns' || attributeName.startsWith('xmlns:');

      if (/^on[a-z]/i.test(localName)) {
        issues.push(`包含不允许的事件属性 ${attribute.name}`);
      }

      if ((localName === 'href' || localName === 'src') && value && !value.startsWith('#')) {
        issues.push(`包含外链资源 ${attribute.name}="${value}"`);
      }

      if (!isNamespaceDeclaration && unsafeExpressionPattern.test(value)) {
        issues.push(`属性 ${attribute.name} 包含不允许的脚本或 expression()`);
      }

      const externalAttributeUrl = findExternalUrl(value);
      if (externalAttributeUrl) {
        issues.push(`属性 ${attribute.name} 包含外链资源 ${externalAttributeUrl}`);
      }
    }
  }

  return Array.from(new Set(issues));
};

const buildSymbolLookup = (config: ILeftAsideConfig) => {
  const lookup = new Map<string, ILeftAsideConfigItemPrivateSymbol>();
  for (const group of config.values()) {
    for (const item of group) {
      if (item.type === 'svg' && item.symbol && !lookup.has(item.id)) {
        lookup.set(item.id, item.symbol);
      }
    }
  }
  return lookup;
};

const getNodeLabel = (node: PublishSvgNode, assetId?: string) =>
  String(node.title || node.tag || assetId || node.id || '未命名图元');

const cloneExportJson = <T extends IExportJson>(exportJson: T): T => {
  try {
    return JSON.parse(JSON.stringify(exportJson)) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new PublishAssetsError([`一次图数据无法深拷贝：${detail}`]);
  }
};

/**
 * 构建只用于发布的 JSON 副本：递归收集 SVG symbol，生成去重资产表，
 * 并移除节点级 symbol。不会修改画布导出数据或本地保存数据。
 */
export const buildPublishExportJson = <T extends IExportJson>(
  exportJson: T,
  options: BuildPublishAssetsOptions
): T => {
  const cloned = cloneExportJson(exportJson);
  const symbolLookup = buildSymbolLookup(options.leftAsideConfig);
  const assets = new Map<string, ISvgAsset>();
  const failedAssetIds = new Set<string>();
  const issues: string[] = [];
  const singleAssetLimit = options.singleAssetDecodedLimit ?? PUBLISH_SVG_SINGLE_ASSET_LIMIT;
  const bundleBase64Limit = options.bundleBase64Limit ?? PUBLISH_SVG_BUNDLE_BASE64_LIMIT;

  const visit = (nodes: PublishSvgNode[]) => {
    for (const node of nodes) {
      if (node.type === 'svg') {
        const assetIdCandidate = node.tag || node.svgAssetId;
        const assetId =
          typeof assetIdCandidate === 'string' && assetIdCandidate.trim()
            ? assetIdCandidate
            : undefined;
        const label = getNodeLabel(node, assetId);

        if (!assetId) {
          issues.push(`图元“${label}”缺少 tag/svgAssetId，无法生成资产 ID`);
        } else {
          node.svgAssetId = assetId;
          const assetIdIssue = validateIdentifier(assetId, 'assetId');
          if (assetIdIssue) {
            if (!failedAssetIds.has(assetId)) {
              issues.push(`图元“${label}”（${assetId}）的 ${assetIdIssue}`);
              failedAssetIds.add(assetId);
            }
          } else if (!assets.has(assetId) && !failedAssetIds.has(assetId)) {
            const source =
              (node.tag ? symbolLookup.get(node.tag) : undefined) ??
              (node.symbol?.symbol_str ? node.symbol : undefined) ??
              symbolLookup.get(assetId);
            if (!source) {
              issues.push(`图元“${label}”（${assetId}）缺少可发布的 SVG symbol`);
              failedAssetIds.add(assetId);
            } else {
              const validationIssues = validateSymbol(source);
              if (validationIssues.length > 0) {
                issues.push(
                  `图元“${label}”（${assetId}）的 SVG 不安全或无效：${validationIssues.join('、')}`
                );
                failedAssetIds.add(assetId);
              } else {
                const decodedSize = getUtf8Bytes(source.symbol_str).byteLength;
                if (decodedSize > singleAssetLimit) {
                  issues.push(
                    `图元“${label}”（${assetId}）大小 ${decodedSize} 字节，超过单个 SVG ${singleAssetLimit} 字节限制`
                  );
                  failedAssetIds.add(assetId);
                } else {
                  try {
                    const contentBase64 = encodeUtf8Base64(source.symbol_str);
                    if (decodeUtf8Base64(contentBase64) !== source.symbol_str) {
                      throw new Error('UTF-8 Base64 往返校验失败');
                    }
                    assets.set(assetId, {
                      encoding: 'base64',
                      format: 'svg-symbol',
                      contentBase64,
                      symbolId: source.symbol_id,
                      width: source.width,
                      height: source.height
                    });
                  } catch (error) {
                    const detail = error instanceof Error ? error.message : String(error);
                    issues.push(`图元“${label}”（${assetId}）Base64 编码失败：${detail}`);
                    failedAssetIds.add(assetId);
                  }
                }
              }
            }
          }
        }

        delete node.symbol;
      }

      if (Array.isArray(node.children) && node.children.length > 0) {
        visit(node.children);
      }
    }
  };

  visit(cloned.json as unknown as PublishSvgNode[]);

  const bundleBase64Size = Array.from(assets.values()).reduce(
    (total, asset) => total + asset.contentBase64.length,
    0
  );
  if (bundleBase64Size > bundleBase64Limit) {
    issues.push(
      `SVG 资产包 Base64 总大小 ${bundleBase64Size} 字节，超过 ${bundleBase64Limit} 字节限制`
    );
  }

  if (issues.length > 0) {
    throw new PublishAssetsError(issues);
  }

  cloned.assetBundleVersion = 1;
  cloned.svgAssets = Object.fromEntries(assets);
  return cloned;
};
