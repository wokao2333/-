import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { globalStore, createDefaultCanvasCfg } from '../store/global';
import { genVectorSvg } from './gen-vector-svg';
import { svgToSymbol } from '../utils/index';
import {
  prepareAtsCanvasSvg,
  protectFilledGeometryFromInheritedStroke
} from '../utils/electrical-symbol';
import type { IDoneJson } from '../store/types';

const baseItem = (overrides: Partial<IDoneJson>): IDoneJson => ({
  id: 'item',
  title: 'item',
  type: 'vue',
  binfo: { left: 0, top: 0, width: 100, height: 100, angle: 0 },
  resize: true,
  rotate: true,
  lock: false,
  active: false,
  hide: false,
  props: {},
  common_animations: { val: '', delay: 'delay-0s', speed: 'slow', repeat: 'infinite' },
  events: [],
  ...overrides
});

afterEach(() => {
  globalStore.done_json = [];
  globalStore.canvasCfg = createDefaultCanvasCfg();
});

describe('genVectorSvg', () => {
  it('flattens the symbol content into primitives with their own transform', async () => {
    globalStore.done_json = [
      baseItem({
        type: 'svg',
        id: 'negative-symbol',
        binfo: { left: 10, top: 20, width: 40, height: 80, angle: 0 },
        symbol: {
          symbol_id: 'negative-symbol',
          symbol_str:
            '<symbol id="negative-symbol" viewBox="-30 -30 60 60"><circle r="6" /></symbol>',
          width: '60',
          height: '60'
        }
      })
    ];

    const svg = await genVectorSvg();

    // 图元坐标保持原样：viewBox(-30 -30 60 60) 放到 40x80 的位置上
    // → 先平移回原点 (20,40)，再缩放到 0.6667 / 1.3333，最后整体平移到 (10,20)
    expect(svg).toContain('translate(10, 20) translate(20, 40) scale(0.6667, 1.3333)');
    expect(svg).toContain('<circle');
    expect(svg.match(/<svg\b/g)?.length).toBe(1);
    expect(svg).not.toContain('<symbol');
    expect(svg).not.toContain('<use');
    expect(svg).not.toContain('foreignObject');
    expect(svg).not.toContain('<filter');
    // 图标不再外包 <g>，只剩图元本身
    expect(svg).not.toContain('<g transform="translate(10, 20)"');
  });

  it('fills solid shapes without adding an extra outline stroke', async () => {
    globalStore.done_json = [
      baseItem({
        type: 'svg',
        id: 'colored-symbol',
        props: { fill: { title: '填充色', type: 'color', val: '#FF0000' } },
        symbol: {
          symbol_id: 'colored-symbol',
          symbol_str:
            '<symbol id="colored-symbol" viewBox="0 0 10 10"><path d="M0 0h10v10z" /></symbol>',
          width: '10',
          height: '10'
        }
      })
    ];

    const svg = await genVectorSvg();

    expect(svg).toContain('fill="#FF0000"');
    // 实心图形不能再叠加描边：导入工具把 stroke-width 当像素处理时会把图标糊成一团
    expect(svg).toContain('stroke="none"');
    expect(svg).not.toContain('stroke="#FF0000"');
  });

  it('keeps the stroke only for shapes that are drawn by outline', async () => {
    globalStore.done_json = [
      baseItem({
        type: 'svg',
        id: 'outline-symbol',
        props: { stroke: { title: '边框色', type: 'color', val: '#00FF00' } },
        symbol: {
          symbol_id: 'outline-symbol',
          symbol_str:
            '<symbol id="outline-symbol" viewBox="0 0 10 10"><path fill="none" d="M0 0h10v10" /><line x1="0" y1="0" x2="10" y2="10" /></symbol>',
          width: '10',
          height: '10'
        }
      })
    ];

    const svg = await genVectorSvg();

    expect(svg).toContain('stroke="#00FF00"');
    expect(svg).toContain('fill="none"');
  });

  it('flattens style / currentColor onto every shape so multicolor icons keep their outline', async () => {
    globalStore.done_json = [
      baseItem({
        type: 'svg',
        id: 'ats',
        props: { color: { title: '图形颜色', type: 'color', val: '#FF0000' } },
        symbol: {
          symbol_id: 'ats',
          symbol_str:
            '<symbol id="ats" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="none" style="stroke:currentcolor" stroke-width="2" /><path fill="currentColor" d="M0 0h5v5z" /><path fill="#5ABF38" d="M1 1h2v2z" /></symbol>',
          width: '10',
          height: '10'
        }
      })
    ];

    const svg = await genVectorSvg();

    // style 声明提升为属性，currentColor 解析成图元的 color
    expect(svg).toContain('stroke="#FF0000"');
    expect(svg).toContain('fill="#FF0000"');
    expect(svg).not.toContain('currentColor');
    expect(svg).not.toContain('currentcolor');
    expect(svg).not.toContain('style=');
    // 显式颜色保持不变
    expect(svg).toContain('fill="#5ABF38"');
  });

  it('inlines <style> class rules so icons drawn via class keep their outline', async () => {
    // Illustrator 导出的图标常用 .st0{fill:none;stroke:...;stroke-width:20} 这种写法
    globalStore.done_json = [
      baseItem({
        type: 'svg',
        id: 'class-symbol',
        props: { stroke: { title: '边框色', type: 'color', val: '#FF0000' } },
        symbol: {
          symbol_id: 'class-symbol',
          symbol_str:
            '<symbol id="class-symbol" viewBox="0 0 222 336"><style>.st0{fill:none;stroke-width:20;stroke-miterlimit:10;}</style><line class="st0" x1="111" y1="0" x2="111" y2="336" /><polygon class="st0" points="111,269 204.92,106.33 17.08,106.33" /></symbol>',
          width: '222',
          height: '336'
        }
      })
    ];

    const svg = await genVectorSvg();

    // 三角形（polygon）必须带上兜底描边和类里的 stroke-width，否则会整块消失
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#FF0000"');
    expect(svg).toContain('stroke-width="20"');
    expect(svg).toContain('<polygon');
    // <style> 已内联成属性，不再留在产物里
    expect(svg).not.toContain('<style');
  });

  it('rewrites closepath + relative moveto into absolute subpaths so importers keep the holes', async () => {
    // 电网图标就是这种复合路径：外轮廓 + 镂空。部分导入工具重写 closepath 后
    // 会把当前点算错，导致第二个子路径整体偏移、镂空消失（变成一个实心块）
    globalStore.done_json = [
      baseItem({
        type: 'svg',
        id: 'grid',
        props: { fill: { title: '填充色', type: 'color', val: '#FF0000' } },
        symbol: {
          symbol_id: 'grid',
          symbol_str:
            '<symbol id="grid" viewBox="0 0 1048 1024"><path d="M343.04 1024H79.555048l52.053333-763.928381h159.378286z m-211.309714-48.761905h159.134476l-45.470476-666.404571h-68.266667z" /></symbol>',
          width: '1048',
          height: '1024'
        }
      })
    ];

    const svg = await genVectorSvg();
    const pathData = svg.match(/<path[^>]*\bd="([^"]+)"/)![1];

    expect(pathData).not.toMatch(/[zZ]/);
    // 第二个子路径必须从绝对坐标开始，不能依赖 closepath 之后的相对位移
    expect(pathData).toContain('M131.7303 975.2381');
    // 第一条子路径的收尾也要显式回到起点
    expect(pathData).toContain('L343.04 1024');
  });

  it('renders the card as a plain stroked rect without filter', async () => {
    globalStore.done_json = [
      baseItem({
        id: 'card',
        type: 'vue',
        tag: 'card-vue',
        binfo: { left: 0, top: 0, width: 200, height: 100, angle: 0 },
        props: {
          backGroundColor: { title: 'bg', type: 'color', val: 'rgba(2, 28, 15, 0.34)' },
          borderColor: { title: 'bd', type: 'color', val: '#35c94a' }
        }
      })
    ];

    const svg = await genVectorSvg();

    expect(svg).toContain('<rect');
    expect(svg).toContain('stroke="#35c94a"');
    expect(svg).toContain('fill-opacity="0.34"');
    expect(svg).not.toContain('filter=');
    expect(svg).not.toContain('<filter');
  });

  it('converts group child percentages into local pixels', async () => {
    const child = baseItem({
      id: 'child',
      type: 'vue',
      binfo: { left: 25, top: 10, width: 50, height: 20, angle: 0 },
      props: { text: { title: 'text', type: 'input', val: 'A' } }
    });
    globalStore.done_json = [
      baseItem({
        id: 'group',
        type: 'group',
        binfo: { left: 100, top: 50, width: 200, height: 100, angle: 0 },
        children: [child]
      })
    ];

    const svg = await genVectorSvg();

    expect(svg).toContain('translate(50, 10)');
    expect(svg).not.toContain('translate(25, 10)');
  });

  it('keeps line points local to the line bounding box', async () => {
    globalStore.done_json = [
      baseItem({
        id: 'line',
        type: 'sys-line',
        binfo: { left: 40, top: 60, width: 80, height: 0, angle: 0 },
        props: {
          stroke: { title: 'stroke', type: 'color', val: '#f00' },
          'stroke-width': { title: 'stroke-width', type: 'number', val: 2 },
          point_position: {
            title: 'points',
            type: 'jsonEdit',
            val: [
              { x: 0, y: 0 },
              { x: 80, y: 0 }
            ]
          },
          'marker-start': { title: 'marker-start', type: 'switch', val: false },
          'marker-end': { title: 'marker-end', type: 'switch', val: false },
          ani_type: { title: 'ani-type', type: 'select', val: 'none' }
        }
      })
    ];

    const svg = await genVectorSvg();

    expect(svg).toContain('translate(40, 60)');
    expect(svg).toContain('M 0 0 L 80 0');
    expect(svg).not.toContain('M 40 60 L 120 60');
    // 实线不再输出 stroke-dasharray="0"，避免部分渲染器把线条当虚线/隐藏
    expect(svg).not.toContain('stroke-dasharray="0"');
  });
});

describe('图标库导出兼容性', () => {
  const listSvgFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return listSvgFiles(full);
      return entry.name.toLowerCase().endsWith('.svg') ? [full] : [];
    });

  /** 与 App.vue 一致的图标预处理（ATS 的 currentColor、一次设备的填充保护） */
  const loadIconSvg = (file: string) => {
    const name = file
      .split('/')
      .pop()!
      .replace(/\.svg$/i, '');
    const source = readFileSync(file, 'utf8');
    if (name === 'ATS') return prepareAtsCanvasSvg(source);
    const raw = protectFilledGeometryFromInheritedStroke(source);
    if (name === '接地' || name === '隔离开关 copy' || name === '开关手车') {
      return raw.replace(/fill="#000000"/g, '').replace(/fill-opacity="1"/g, '');
    }
    return raw;
  };

  it('每个图标导出后都不依赖 symbol/use/嵌套 svg/style/currentColor，且图形元素自带颜色', async () => {
    const files = listSvgFiles(join(process.cwd(), 'src/assets/svgs/electrical'));
    expect(files.length).toBeGreaterThan(10);

    for (const [index, file] of files.entries()) {
      const label = file.split('/').pop();
      const symbol = svgToSymbol(loadIconSvg(file), `icon-${index}`);
      globalStore.done_json = [
        baseItem({
          id: `icon-${index}`,
          type: 'svg',
          binfo: { left: 0, top: 0, width: 60, height: 60, angle: 0 },
          props: { stroke: { title: '边框色', type: 'color', val: '#FF0000' } },
          symbol: { symbol_id: `icon-${index}`, ...symbol }
        })
      ];

      const svg = await genVectorSvg();
      const lower = svg.toLowerCase();
      expect(lower, `${label} 不应出现 symbol`).not.toContain('<symbol');
      expect(lower, `${label} 不应出现 use`).not.toContain('<use');
      expect(lower, `${label} 不应出现 foreignObject`).not.toContain('foreignobject');
      expect(svg.match(/<svg\b/g)?.length, `${label} 不应出现嵌套 svg`).toBe(1);
      expect(lower, `${label} 不应出现 style 属性`).not.toContain('style=');
      expect(lower, `${label} 不应出现 currentColor`).not.toContain('currentcolor');
      expect(lower, `${label} 不应出现 filter`).not.toContain('<filter');
    }
  });
});
