import { describe, expect, it } from 'vitest';
import type { IExportJson } from '../components/types';
import type {
  ILeftAsideConfig,
  ILeftAsideConfigItem,
  ILeftAsideConfigItemPrivateSymbol
} from '../store/types';
import {
  PUBLISH_SVG_BUNDLE_BASE64_LIMIT,
  PUBLISH_SVG_SINGLE_ASSET_LIMIT,
  PublishAssetsError,
  buildPublishExportJson,
  decodeUtf8Base64
} from './publish-assets';

const makeSymbol = (
  id: string,
  content = '<path d="M0 0h10v10z" />'
): ILeftAsideConfigItemPrivateSymbol => ({
  symbol_id: id,
  symbol_str: `<symbol id="${id}" viewBox="0 0 10 10">${content}</symbol>`,
  width: '10',
  height: '10'
});

const makeConfig = (...symbols: ILeftAsideConfigItemPrivateSymbol[]): ILeftAsideConfig =>
  new Map([
    [
      '测试图元',
      symbols.map(
        (symbol): ILeftAsideConfigItem => ({
          id: symbol.symbol_id,
          title: symbol.symbol_id,
          type: 'svg',
          thumbnail: '',
          props: {},
          symbol,
          common_animations: {
            val: '',
            delay: '',
            speed: '',
            repeat: ''
          }
        })
      )
    ]
  ]);

const makeExportJson = (json: unknown[]): IExportJson => ({
  canvasCfg: {} as IExportJson['canvasCfg'],
  gridCfg: {} as IExportJson['gridCfg'],
  json: json as IExportJson['json']
});

describe('buildPublishExportJson', () => {
  it('递归收集任意层级 SVG、按 assetId 去重并正确编码中文', () => {
    const configSymbol = makeSymbol('中文图元', '<text>储能电池：正常</text>');
    const nodeSymbol = makeSymbol('节点图元', '<text>节点内嵌</text>');
    const input = makeExportJson([
      {
        id: 'group-1',
        type: 'group',
        children: [
          {
            id: 'group-2',
            type: 'group',
            children: [
              { id: 'svg-1', title: '中文图元一', type: 'svg', tag: '中文图元' },
              { id: 'svg-2', title: '中文图元二', type: 'svg', tag: '中文图元' }
            ]
          },
          {
            id: 'svg-3',
            title: '节点图元',
            type: 'svg',
            tag: '节点图元',
            symbol: nodeSymbol
          }
        ]
      }
    ]);
    const original = JSON.stringify(input);

    const result = buildPublishExportJson(input, {
      leftAsideConfig: makeConfig(configSymbol)
    });
    const root = result.json[0] as unknown as {
      children: Array<{
        children?: Array<{ svgAssetId: string }>;
        svgAssetId?: string;
        symbol?: unknown;
      }>;
    };

    expect(result.assetBundleVersion).toBe(1);
    expect(Object.keys(result.svgAssets ?? {}).sort()).toEqual(['中文图元', '节点图元'].sort());
    expect(root.children[0].children?.map((item) => item.svgAssetId)).toEqual([
      '中文图元',
      '中文图元'
    ]);
    expect(root.children[1].svgAssetId).toBe('节点图元');
    expect(root.children[1]).not.toHaveProperty('symbol');
    expect(decodeUtf8Base64(result.svgAssets!['中文图元'].contentBase64)).toBe(
      configSymbol.symbol_str
    );
    expect(decodeUtf8Base64(result.svgAssets!['节点图元'].contentBase64)).toBe(
      nodeSymbol.symbol_str
    );
    expect(JSON.stringify(input)).toBe(original);
    expect(input).not.toHaveProperty('assetBundleVersion');
  });

  it('缺少 tag 或可用 symbol 时抛出包含图元名称的可读错误', () => {
    const input = makeExportJson([
      { id: 'svg-no-tag', title: '无标识图元', type: 'svg' },
      { id: 'svg-no-source', title: '丢失资源图元', type: 'svg', tag: 'missing' }
    ]);

    expect(() => buildPublishExportJson(input, { leftAsideConfig: new Map() })).toThrowError(
      PublishAssetsError
    );

    try {
      buildPublishExportJson(input, { leftAsideConfig: new Map() });
    } catch (error) {
      expect((error as Error).message).toContain('无标识图元');
      expect((error as Error).message).toContain('丢失资源图元');
      expect((error as Error).message).toContain('缺少可发布的 SVG symbol');
    }
  });

  it.each([
    ['script', '<script>alert(1)</script>'],
    ['foreignObject', '<foreignObject><div>bad</div></foreignObject>'],
    ['metadata', '<metadata>不应发布</metadata>'],
    ['animate', '<animate attributeName="opacity" from="0" to="1" />'],
    ['set', '<set attributeName="fill" to="red" />'],
    ['xml-stylesheet', '<?xml-stylesheet href="https://example.com/a.css"?><path />'],
    ['事件属性', '<path onload="alert(1)" />'],
    ['href 外链', '<image href="https://example.com/a.png" />'],
    ['data 协议资源', '<path style="fill:url(data:image/png;base64,AAAA)" />'],
    ['CSS url 外链', '<path fill="url(https://example.com/a.svg#paint)" />']
  ])('拒绝包含%s的不安全 SVG', (_label, content) => {
    const unsafeSymbol = makeSymbol('unsafe', content);
    const input = makeExportJson([
      { id: 'unsafe-node', title: '危险图元', type: 'svg', tag: 'unsafe', symbol: unsafeSymbol }
    ]);

    expect(() => buildPublishExportJson(input, { leftAsideConfig: new Map() })).toThrowError(
      /危险图元.*不安全或无效/
    );
  });

  it('tag 优先于遗留 svgAssetId，并优先使用当前图元库中的同 tag symbol', () => {
    const currentSymbol = makeSymbol('current-tag', '<text>当前版本</text>');
    const staleNodeSymbol = makeSymbol('current-tag', '<text>旧版本</text>');
    const input = makeExportJson([
      {
        id: 'updated-node',
        title: '已更新图元',
        type: 'svg',
        tag: 'current-tag',
        svgAssetId: 'legacy-id',
        symbol: staleNodeSymbol
      }
    ]);

    const result = buildPublishExportJson(input, {
      leftAsideConfig: makeConfig(currentSymbol)
    });

    expect(result.json[0].svgAssetId).toBe('current-tag');
    expect(Object.keys(result.svgAssets ?? {})).toEqual(['current-tag']);
    expect(decodeUtf8Base64(result.svgAssets!['current-tag'].contentBase64)).toBe(
      currentSymbol.symbol_str
    );
  });

  it('拒绝根元素不是单一 symbol 或根 id 与 symbolId 不一致的资源', () => {
    const invalidRoot: ILeftAsideConfigItemPrivateSymbol = {
      ...makeSymbol('expected'),
      symbol_str: '<svg id="other" viewBox="0 0 10 10"><path /></svg>'
    };
    const input = makeExportJson([
      { id: 'bad-root', title: '错误根元素', type: 'svg', tag: 'expected', symbol: invalidRoot }
    ]);

    expect(() => buildPublishExportJson(input, { leftAsideConfig: new Map() })).toThrowError(
      /根元素必须是 <symbol>.*symbolId 与 <symbol id> 不一致/
    );
  });

  it('拒绝消费端无法接受的 assetId、symbolId 与 SVG 尺寸', () => {
    const invalidSymbol = {
      ...makeSymbol('bad\n-id'),
      width: '0',
      height: '10vh'
    };
    const invalidAssetIdInput = makeExportJson([
      {
        id: 'invalid-contract',
        title: '协议非法图元',
        type: 'svg',
        tag: `asset-${'x'.repeat(260)}`,
        symbol: invalidSymbol
      }
    ]);

    expect(() =>
      buildPublishExportJson(invalidAssetIdInput, { leftAsideConfig: new Map() })
    ).toThrowError(/assetId 长度不能超过 256/);

    const invalidSymbolInput = makeExportJson([
      {
        id: 'invalid-symbol-contract',
        title: '符号协议非法图元',
        type: 'svg',
        tag: 'valid-asset',
        symbol: invalidSymbol
      }
    ]);
    expect(() =>
      buildPublishExportJson(invalidSymbolInput, { leftAsideConfig: new Map() })
    ).toThrowError(/symbolId 不能包含控制字符.*width 必须大于 0.*height 不是合法的 SVG 尺寸/);
  });

  it('拒绝 decoded 大小超过 256 KiB 的单个 SVG', () => {
    const oversized = makeSymbol(
      'oversized',
      `<text>${'a'.repeat(PUBLISH_SVG_SINGLE_ASSET_LIMIT)}</text>`
    );
    const input = makeExportJson([
      { id: 'oversized', title: '超大图元', type: 'svg', tag: 'oversized', symbol: oversized }
    ]);

    expect(() => buildPublishExportJson(input, { leftAsideConfig: new Map() })).toThrowError(
      /超大图元.*超过单个 SVG 262144 字节限制/
    );
  });

  it('拒绝唯一资产 Base64 总量超过 1 MiB 的发布包', () => {
    const content = `<text>${'a'.repeat(200 * 1024)}</text>`;
    const symbols = Array.from({ length: 4 }, (_, index) => makeSymbol(`asset-${index}`, content));
    const input = makeExportJson(
      symbols.map((symbol, index) => ({
        id: `node-${index}`,
        title: `图元${index}`,
        type: 'svg',
        tag: symbol.symbol_id,
        symbol
      }))
    );

    expect(() => buildPublishExportJson(input, { leftAsideConfig: new Map() })).toThrowError(
      new RegExp(
        `SVG 资产包 Base64 总大小 \\d+ 字节，超过 ${PUBLISH_SVG_BUNDLE_BASE64_LIMIT} 字节限制`
      )
    );
  });
});
