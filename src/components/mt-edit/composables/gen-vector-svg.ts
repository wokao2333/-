import html2canvas from 'html2canvas';
import { globalStore } from '../store/global';
import { positionArrarToPath } from '../utils/index';
import type { IDoneJson, IDoneJsonBinfo } from '../store/types';

type DoneJsonWithChildren = IDoneJson & { children?: IDoneJson[] };
type ParentSize = Pick<IDoneJsonBinfo, 'width' | 'height'>;

const getChildren = (item: IDoneJson): IDoneJson[] => (item as DoneJsonWithChildren).children ?? [];

const escapeSvgAttr = (value: string): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeSvgText = (value: string): string =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const getProp = <T>(item: IDoneJson, key: string, fallback: T): T => {
  const value = item.props?.[key]?.val;
  return (value === undefined || value === null ? fallback : value) as T;
};

const getNumberProp = (item: IDoneJson, key: string, fallback: number): number => {
  const value = Number(getProp(item, key, fallback));
  return Number.isFinite(value) ? value : fallback;
};

const isTruthy = (value: unknown) => value === true || value === 1 || value === 'true';

const getSymbolViewBox = (symbolStr: string, width: string, height: string) => {
  const match = symbolStr.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  return match?.[1]?.trim() || `0 0 ${width} ${height}`;
};

const round = (value: number) => Number(value.toFixed(4));

type ViewBox = { minX: number; minY: number; width: number; height: number };

const parseViewBox = (viewBox: string, width: string, height: string): ViewBox => {
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    parts.length === 4 &&
    parts.every((value) => Number.isFinite(value)) &&
    parts[2] > 0 &&
    parts[3] > 0
  ) {
    return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
  }
  return {
    minX: 0,
    minY: 0,
    width: Math.max(Number(width) || 1, 1),
    height: Math.max(Number(height) || 1, 1)
  };
};

const getLocalBinfo = (item: IDoneJson, parentSize?: ParentSize): IDoneJsonBinfo => {
  const binfo = item.binfo;
  if (!parentSize) return binfo;

  // group-render uses percentage values for every child binfo field.
  return {
    left: (parentSize.width * Number(binfo.left || 0)) / 100,
    top: (parentSize.height * Number(binfo.top || 0)) / 100,
    width: (parentSize.width * Number(binfo.width || 0)) / 100,
    height: (parentSize.height * Number(binfo.height || 0)) / 100,
    angle: Number(binfo.angle || 0)
  };
};

const measureTextWidth = (text: string, fontSize: number, fontFamily: string, bold = false) => {
  if (typeof document === 'undefined') return text.length * fontSize * 0.6;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return text.length * fontSize * 0.6;
  context.font = `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily || 'sans-serif'}`;
  return context.measureText(text).width;
};

/** 与绘制相关的属性：既是 props 可透传的白名单，也是内联时要落到元素上的属性 */
const PAINT_KEYS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'fill-opacity',
  'fill-rule',
  'clip-rule',
  'opacity',
  'color'
] as const;

type PaintKey = (typeof PAINT_KEYS)[number];
type PaintState = Partial<Record<PaintKey, string>> & {
  /** 图元颜色：仅在“没有填充、只能靠描边成形”的图形上兜底为描边色 */
  mirror?: string;
};

/** 真正绘制像素的标签，导出时要把生效颜色直接写到它们身上 */
const PAINT_SHAPE_TAGS = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan'
]);

const isPaintKey = (key: string): key is PaintKey =>
  (PAINT_KEYS as readonly string[]).includes(key);

/**
 * 其余可以直接落到元素上的 SVG 表现属性。
 * 把 style 里的这些声明提升为属性，产物就完全不需要 style（多数导入工具不解析 style）。
 */
const PRESENTATION_ATTRIBUTES = new Set([
  'alignment-baseline',
  'baseline-shift',
  'clip-path',
  'display',
  'dominant-baseline',
  'filter',
  'font-family',
  'font-size',
  'font-stretch',
  'font-style',
  'font-weight',
  'letter-spacing',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'overflow',
  'paint-order',
  'shape-rendering',
  'stop-color',
  'stop-opacity',
  'stroke-miterlimit',
  'text-anchor',
  'text-decoration',
  'text-rendering',
  'transform',
  'vector-effect',
  'visibility',
  'word-spacing',
  'writing-mode'
]);

const isCurrentColor = (value: string) => /^currentcolor$/i.test(value.trim());

/**
 * 图元 props → 初始继承状态。
 * 画布中符号图元通过 <use fill stroke> 控制颜色（fill 同时作为 stroke 使用），
 * ATS 这类多色图元则只传 color，由 currentColor 取色。
 *
 * 注意：这里的 stroke 默认为 none，图元颜色放到 mirror 里作为兜底。
 * 原因是浏览器里 stroke 会被缩放到亚像素（肉眼不可见），而不少导入工具
 * 会把 stroke-width 当成“像素”处理，实心图形被再描一圈粗边后，
 * 内部细缝会被糊住——电网图标就是这么变成一团粗块的。
 */
const getInheritedPaint = (props: IDoneJson['props'] | undefined): PaintState => {
  const fill = props?.fill?.val;
  const stroke = props?.stroke?.val;
  const color = props?.color?.val;
  const paint = fill || stroke;
  return {
    color: color ? String(color) : '#000000',
    fill: paint ? String(paint) : '#000000',
    stroke: 'none',
    mirror: paint ? String(paint) : undefined
  };
};

type CssRule = { selector: string; declarations: Record<string, string> };

/**
 * 解析图标内嵌 <style> 里的简单规则（.class / #id / tag）。
 * 很多设计软件导出的图标（Illustrator 的 .st0/.st1）靠 class 携带
 * fill:none / stroke-width 等信息，不解析就会把图形画丢。
 */
const collectStyleRules = (root: Element): CssRule[] => {
  const rules: CssRule[] = [];
  for (const styleNode of Array.from(root.querySelectorAll('style'))) {
    const cssText = styleNode.textContent ?? '';
    for (const match of cssText.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const declarations: Record<string, string> = {};
      for (const part of match[2].split(';')) {
        const separator = part.indexOf(':');
        if (separator < 0) continue;
        const key = part.slice(0, separator).trim().toLowerCase();
        const value = part.slice(separator + 1).trim();
        if (key && value) declarations[key] = value;
      }
      for (const rawSelector of match[1].split(',')) {
        const selector = rawSelector.trim();
        // 只处理最简单的选择器，复杂选择器交给工具自己解析 <style>
        if (/^[.#]?[\w-]+$/.test(selector)) rules.push({ selector, declarations });
      }
    }
  }
  return rules;
};

const PATH_PARAM_COUNT: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7
};

const formatPathNumber = (value: number) => String(Math.round(value * 10000) / 10000);

/**
 * 把路径语法统一成“全绝对坐标 + 不使用 z”。
 *
 * 为什么要去掉 z：不少在线 SVG 工具在导入时会把路径重写成全相对坐标，
 * 而它们实现 closepath 时不会把当前点重置到子路径起点——于是 z 后面
 * 紧跟的相对 moveto（电网图标正是这种结构）整体偏移，
 * 表现就是“塔身糊成一个实心块、镂空消失”。
 * 这里把 z 换成显式回到起点的直线，后面接绝对 M，任何解析器都不会算错。
 */
const normalizePathData = (d: string): string => {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens?.length) return d;

  const out: string[] = [];
  let index = 0;
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  let command = '';
  let hasSubpath = false;

  const nextNumber = () => {
    const value = Number(tokens[index]);
    index += 1;
    return Number.isFinite(value) ? value : 0;
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[a-zA-Z]$/.test(token)) {
      command = token;
      index += 1;
    } else if (!command) {
      index += 1;
      continue;
    }

    const upper = command.toUpperCase();
    const relative = command !== upper;

    if (upper === 'Z') {
      if (
        hasSubpath &&
        (Math.abs(currentX - startX) > 1e-6 || Math.abs(currentY - startY) > 1e-6)
      ) {
        out.push(`L${formatPathNumber(startX)} ${formatPathNumber(startY)}`);
      }
      currentX = startX;
      currentY = startY;
      command = '';
      continue;
    }

    const paramCount = PATH_PARAM_COUNT[upper];
    if (!paramCount) {
      index += 1;
      continue;
    }

    const params: number[] = [];
    for (let cursor = 0; cursor < paramCount; cursor += 1) params.push(nextNumber());
    const abs = (value: number, origin: number) => (relative ? value + origin : value);

    switch (upper) {
      case 'M': {
        currentX = abs(params[0], currentX);
        currentY = abs(params[1], currentY);
        startX = currentX;
        startY = currentY;
        hasSubpath = true;
        out.push(`M${formatPathNumber(currentX)} ${formatPathNumber(currentY)}`);
        // M 之后紧跟的坐标对等价于 L
        command = 'L';
        break;
      }
      case 'L': {
        currentX = abs(params[0], currentX);
        currentY = abs(params[1], currentY);
        out.push(`L${formatPathNumber(currentX)} ${formatPathNumber(currentY)}`);
        break;
      }
      case 'H': {
        currentX = abs(params[0], currentX);
        out.push(`L${formatPathNumber(currentX)} ${formatPathNumber(currentY)}`);
        break;
      }
      case 'V': {
        currentY = abs(params[0], currentY);
        out.push(`L${formatPathNumber(currentX)} ${formatPathNumber(currentY)}`);
        break;
      }
      case 'C': {
        const x1 = abs(params[0], currentX);
        const y1 = abs(params[1], currentY);
        const x2 = abs(params[2], currentX);
        const y2 = abs(params[3], currentY);
        currentX = abs(params[4], currentX);
        currentY = abs(params[5], currentY);
        out.push(
          `C${formatPathNumber(x1)} ${formatPathNumber(y1)} ${formatPathNumber(
            x2
          )} ${formatPathNumber(y2)} ${formatPathNumber(currentX)} ${formatPathNumber(currentY)}`
        );
        break;
      }
      case 'S':
      case 'Q': {
        const x1 = abs(params[0], currentX);
        const y1 = abs(params[1], currentY);
        currentX = abs(params[2], currentX);
        currentY = abs(params[3], currentY);
        out.push(
          `${upper}${formatPathNumber(x1)} ${formatPathNumber(y1)} ${formatPathNumber(
            currentX
          )} ${formatPathNumber(currentY)}`
        );
        break;
      }
      case 'T': {
        currentX = abs(params[0], currentX);
        currentY = abs(params[1], currentY);
        out.push(`T${formatPathNumber(currentX)} ${formatPathNumber(currentY)}`);
        break;
      }
      case 'A': {
        const endX = abs(params[5], currentX);
        const endY = abs(params[6], currentY);
        out.push(
          `A${formatPathNumber(params[0])} ${formatPathNumber(params[1])} ${formatPathNumber(
            params[2]
          )} ${params[3]} ${params[4]} ${formatPathNumber(endX)} ${formatPathNumber(endY)}`
        );
        currentX = endX;
        currentY = endY;
        break;
      }
      default:
        break;
    }
  }

  return out.length ? out.join(' ') : d;
};

/** 判断填充是否“看不见”：none / transparent / 透明度为 0 的 rgba */
const isInvisibleFill = (fill: string, fillOpacity: number) => {
  const value = fill.trim().toLowerCase();
  if (value === 'none' || value === 'transparent') return true;
  if (fillOpacity === 0) return true;
  const rgba = value.match(/^rgba\([^)]*?,\s*([\d.]+)\s*\)$/);
  return Boolean(rgba && Number(rgba[1]) === 0);
};

const matchesSelector = (element: Element, selector: string) => {
  if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));
  if (selector.startsWith('#')) return element.getAttribute('id') === selector.slice(1);
  return element.nodeName.toLowerCase() === selector.toLowerCase();
};

/**
 * 把继承来的绘制属性（含 style 声明、class 样式、currentColor）落到每个图形元素上。
 *
 * 原因：svg-edit / Figma 之类的工具不解析 style 声明和 <style> 里的 class 样式，
 * 也不保证 <g> 上的 fill/stroke 会继承给子元素，currentColor 更是普遍解析不了。
 * 结果是“图标轮廓整块消失”或“填充丢失”。
 */
const applyInheritedPaint = (element: Element, parent: PaintState, rules: CssRule[] = []) => {
  const declarations: Record<string, string> = {};
  for (const key of PAINT_KEYS) {
    const value = element.getAttribute(key);
    if (value !== null && value.trim()) declarations[key] = value.trim();
  }

  // class 样式的优先级高于表现属性（与 CSS 一致）
  for (const rule of rules) {
    if (!matchesSelector(element, rule.selector)) continue;
    for (const [key, value] of Object.entries(rule.declarations)) {
      if (isPaintKey(key)) declarations[key] = value;
    }
  }

  // style 中的声明优先级最高，处理完绘制属性后其余声明原样保留
  const restStyle: string[] = [];
  const directAttributes = new Map<string, string>();
  const style = element.getAttribute('style');
  // 含 url()/data URI 的 style 直接原样保留，避免按 ";" 切分时破坏内容
  const keepStyleIntact = Boolean(style && /url\s*\(/i.test(style));
  if (style && !keepStyleIntact) {
    for (const part of style.split(';')) {
      const separator = part.indexOf(':');
      if (separator < 0) continue;
      const key = part.slice(0, separator).trim().toLowerCase();
      const value = part.slice(separator + 1).trim();
      if (!key || !value) continue;
      if (isPaintKey(key)) declarations[key] = value;
      else if (PRESENTATION_ATTRIBUTES.has(key)) directAttributes.set(key, value);
      else restStyle.push(`${key}:${value}`);
    }
  }

  const parentColor = parent.color ?? '#000000';
  const ownColor = declarations.color;
  const color = ownColor && !isCurrentColor(ownColor) ? ownColor : parentColor;
  const resolve = (value: string | undefined) =>
    value === undefined ? undefined : isCurrentColor(value) ? color : value;

  const state: PaintState = {
    color,
    fill: resolve(declarations.fill) ?? parent.fill,
    stroke: resolve(declarations.stroke) ?? parent.stroke,
    mirror: parent.mirror
  };
  for (const key of PAINT_KEYS) {
    if (key === 'fill' || key === 'stroke' || key === 'color') continue;
    state[key] = declarations[key] ?? parent[key];
  }

  const tagName = element.nodeName.toLowerCase();
  if (PAINT_SHAPE_TAGS.has(tagName)) {
    for (const key of PAINT_KEYS) {
      if (key === 'color') continue;
      const value = state[key];
      if (value !== undefined && value !== '') element.setAttribute(key, value);
    }

    // 只有「没有填充、只能靠描边成形」的图形才把图元颜色兜底成描边，
    // 实心图形保持 stroke="none"，避免导入工具把图标描粗糊成一片
    const fillValue = state.fill ?? '#000000';
    const fillOpacity = Number(state['fill-opacity'] ?? 1);
    const strokeValue = state.stroke ?? 'none';
    if (strokeValue === 'none' && state.mirror) {
      const needStroke = tagName === 'line' || isInvisibleFill(fillValue, fillOpacity);
      element.setAttribute('stroke', needStroke ? state.mirror : 'none');
      if (!needStroke) element.removeAttribute('stroke-width');
    }
  }

  // style 中其余表现属性（如 stroke-miterlimit / font-size / transform）直接提升为属性
  for (const [key, value] of directAttributes) element.setAttribute(key, value);

  // 路径统一成绝对坐标且不用 z，规避导入工具把 closepath 之后的位置算错
  if (tagName === 'path') {
    const pathData = element.getAttribute('d');
    if (pathData) element.setAttribute('d', normalizePathData(pathData));
  }

  element.removeAttribute('color');
  // keepStyleIntact 时保留原 style 不动
  if (!keepStyleIntact) {
    if (restStyle.length) element.setAttribute('style', restStyle.join(';'));
    else element.removeAttribute('style');
  }

  for (const child of Array.from(element.children)) applyInheritedPaint(child, state, rules);
};

/** 去掉内联图元里对渲染无用的噪声：重复的 xmlns、图标站点导出的私有属性 */
const cleanupInlinedMarkup = (markup: string) =>
  markup
    .replace(/\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')
    .replace(/\s+p-id="[^"]*"/g, '')
    .replace(/\s+data-[\w-]+="[^"]*"/g, '')
    .replace(/\s+t="\d+"/g, '');

const serializeElement = (node: Element): string =>
  cleanupInlinedMarkup(new XMLSerializer().serializeToString(node));

/** 容器类标签：展开它们，把变换下推到每个图元上 */
const CONTAINER_TAGS = new Set(['g', 'a', 'svg', 'symbol', 'switch']);

/** 纯描述信息，导出时直接丢弃 */
const NON_VISUAL_TAGS = new Set(['title', 'desc', 'metadata']);

/** 定义类节点：原样保留（渐变/裁剪/蒙版等可能被图元引用），不参与变换 */
const PRESERVED_TAGS = new Set([
  'defs',
  'style',
  'clippath',
  'mask',
  'marker',
  'lineargradient',
  'radialgradient',
  'pattern',
  'filter'
]);

const composeTransform = (parent: string, own: string | null | undefined) =>
  [parent, own?.trim()].filter(Boolean).join(' ').trim();

/**
 * 把图标展开成“平铺图元”：每个 path/rect/... 都带上完整 transform，不再有嵌套 <g>。
 *
 * 这样产物结构与 svg-edit 自己导出的文件一致（每个图形各自带 transform），
 * 对只做简单结构遍历的导入工具最友好。
 */
const flattenElements = (nodes: Element[], transform: string): string => {
  const parts: string[] = [];
  for (const node of nodes) {
    const tag = node.nodeName.toLowerCase();
    if (NON_VISUAL_TAGS.has(tag)) continue;

    if (PRESERVED_TAGS.has(tag)) {
      parts.push(serializeElement(node));
      continue;
    }

    const composed = composeTransform(transform, node.getAttribute('transform'));
    if (CONTAINER_TAGS.has(tag)) {
      const nested = flattenElements(Array.from(node.children), composed);
      if (nested) parts.push(nested);
      continue;
    }

    if (composed) node.setAttribute('transform', composed);
    else node.removeAttribute('transform');
    parts.push(serializeElement(node));
  }
  return parts.filter(Boolean).join('');
};

/**
 * 把 rgba()/#rrggbbaa 拆成“颜色 + 透明度”。
 * SVG 1.1 只认颜色属性 + *-opacity，部分导入工具会直接丢掉 rgba() 写法。
 */
const splitColorAlpha = (value: string) => {
  const rgba = value.match(
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i
  );
  if (rgba) {
    const toHex = (part: string) =>
      Math.max(0, Math.min(255, Math.round(Number(part))))
        .toString(16)
        .padStart(2, '0');
    return {
      color: `#${toHex(rgba[1])}${toHex(rgba[2])}${toHex(rgba[3])}`,
      opacity: rgba[4] === undefined ? 1 : Number(rgba[4])
    };
  }
  const hexAlpha = value.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
  if (hexAlpha) {
    return { color: `#${hexAlpha[1]}`, opacity: Number.parseInt(hexAlpha[2], 16) / 255 };
  }
  return { color: value, opacity: 1 };
};

const opacityAttr = (name: string, opacity: number) =>
  Number.isFinite(opacity) && opacity < 1 ? ` ${name}="${Number(opacity.toFixed(3))}"` : '';

/**
 * 解析 <symbol>，把继承颜色落到每个图形元素上，并返回它的子图元。
 *
 * 导出时不再依赖 <symbol>/<use>：这两者几乎只有浏览器能正确解析，
 * Figma、Illustrator、svg-edit 之类的工具会直接丢掉或用错位置，
 * 表现为“导出的图在别的工具里不完整”。
 */
const parseSymbolMarkup = (symbolStr: string, inherited: PaintState): Element[] => {
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(symbolStr, 'image/svg+xml');
      const root = doc.documentElement;
      if (root && root.nodeName.toLowerCase() === 'symbol') {
        const rules = collectStyleRules(root);
        applyInheritedPaint(root, inherited, rules);
        // 规则已内联成属性，删掉 <style> 免得工具再按 CSS 覆盖一次
        root.querySelectorAll('style').forEach((node) => node.remove());
        return Array.from(root.children);
      }
    } catch {
      // 解析失败时返回空，调用方会退化成跳过该图元
    }
  }
  return [];
};

const renderText = (item: IDoneJson) => {
  const fontSize = getNumberProp(item, 'fontSize', 15);
  const fontFamily = String(getProp(item, 'fontFamily', ''));
  const fill = String(getProp(item, 'fill', '#000000') || '#000000');
  const text = String(getProp(item, 'text', ''));
  const vertical = isTruthy(getProp(item, 'vertical', false));
  if (!text) return '';

  const fontFamilyAttr = fontFamily ? ` font-family="${escapeSvgAttr(fontFamily)}"` : '';
  // 竖排使用 SVG2/CSS 标准值 vertical-rl，SVG 1.1 的 tb 在多数工具里已不生效
  const verticalAttrs = vertical
    ? ' writing-mode="vertical-rl" letter-spacing="5" dominant-baseline="hanging"'
    : '';
  const lines = text.split(/\n/);
  const y = vertical ? 0 : fontSize;

  return `<text x="0" y="${y}"${fontFamilyAttr} font-size="${fontSize}" fill="${escapeSvgAttr(
    fill
  )}" xml:space="preserve"${verticalAttrs}>${lines
    .map((line, index) =>
      index === 0
        ? escapeSvgText(line)
        : `<tspan x="0" dy="${fontSize * 1.2}">${escapeSvgText(line)}</tspan>`
    )
    .join('')}</text>`;
};

const renderBusbar = (item: IDoneJson, binfo: IDoneJsonBinfo): string => {
  const { width, height } = binfo;
  const label = String(getProp(item, 'label', ''));
  const stroke = String(getProp(item, 'stroke', '#ff0000'));
  const strokeWidth = getNumberProp(item, 'strokeWidth', 4);
  const fontSize = getNumberProp(item, 'fontSize', 20);
  const labelGap = getNumberProp(item, 'labelGap', 12);
  const labelColor = String(getProp(item, 'labelColor', '#ffffff') || '#ffffff');
  const fontFamily = 'sans-serif';
  const lineY = height / 2;
  const lineX = measureTextWidth(label, fontSize, fontFamily, true) + labelGap;

  // 用基线偏移代替 dominant-baseline="middle"：部分 SVG 工具不支持该属性，文字会偏上/偏下
  const labelSvg = label
    ? `<text x="0" y="${
        lineY + fontSize * 0.35
      }" font-family="${fontFamily}" font-size="${fontSize}" font-weight="bold" fill="${escapeSvgAttr(
        labelColor
      )}">${escapeSvgText(label)}</text>`
    : '';
  const lineSvg =
    lineX < width
      ? `<line x1="${lineX}" y1="${lineY}" x2="${width}" y2="${lineY}" stroke="${escapeSvgAttr(
          stroke
        )}" stroke-width="${strokeWidth}" stroke-linecap="butt"></line>`
      : '';

  return `${labelSvg}${lineSvg}`;
};

/**
 * 卡片图元：只输出一个带描边的 <rect>。
 * 画布上的外发光依赖 CSS box-shadow / SVG filter，多数导入工具不支持 filter，
 * 且 filter 引用失效时元素会被整块丢弃（表现为“绿色边框不见了”），因此这里直接省略发光。
 */
const renderCardVue = (item: IDoneJson, binfo: IDoneJsonBinfo): string => {
  const { width, height } = binfo;
  const background = String(getProp(item, 'backGroundColor', 'rgba(2, 28, 15, 0.34)'));
  const borderColor = String(getProp(item, 'borderColor', '#35c94a'));
  const x = width * 0.025;
  const y = height * 0.025;
  const cardWidth = width * 0.95;
  const cardHeight = height * 0.95;
  const backgroundPaint = splitColorAlpha(background);
  const borderPaint = splitColorAlpha(borderColor);

  return `<rect x="${round(x)}" y="${round(y)}" width="${round(cardWidth)}" height="${round(
    cardHeight
  )}" fill="${escapeSvgAttr(backgroundPaint.color)}"${opacityAttr(
    'fill-opacity',
    backgroundPaint.opacity
  )} stroke="${escapeSvgAttr(borderPaint.color)}"${opacityAttr(
    'stroke-opacity',
    borderPaint.opacity
  )} stroke-width="1"></rect>`;
};

const renderKvVue = (item: IDoneJson, binfo: IDoneJsonBinfo): string => {
  const { height } = binfo;
  const label = String(getProp(item, 'label', ''));
  const value = String(getProp(item, 'value', ''));
  const unit = String(getProp(item, 'unit', '单位'));
  const fontFamily = String(getProp(item, 'fontFamily', ''));
  const defaultSize = getNumberProp(item, 'fontSize', 15);
  const defaultColor = String(getProp(item, 'color', '#000000') || '#000000');
  const labelFontSize = getNumberProp(item, 'labelFontSize', defaultSize);
  const valueFontSize = getNumberProp(item, 'valueFontSize', defaultSize);
  const unitFontSize = getNumberProp(item, 'unitFontSize', defaultSize);
  const labelColor = String(getProp(item, 'labelColor', '') || defaultColor);
  const valueColor = String(getProp(item, 'valueColor', '') || defaultColor);
  const unitColor = String(getProp(item, 'unitColor', '') || defaultColor);
  const labelWidth = getNumberProp(item, 'labelWidth', 50);
  const valueWidth = getNumberProp(item, 'valueWidth', 50);
  const unitGap = getNumberProp(item, 'unitGap', 4);
  const paddingX = getNumberProp(item, 'paddingX', 10);
  const fontFamilyAttr = fontFamily ? ` font-family="${escapeSvgAttr(fontFamily)}"` : '';
  const labelX = paddingX + labelWidth;
  const valueX = labelX + valueWidth;
  const unitX = valueX + unitGap * 2;
  const baseline = (fontSize: number) => height / 2 + fontSize * 0.36;

  const labelSvg = label
    ? `<text x="${labelX}" y="${baseline(
        labelFontSize
      )}"${fontFamilyAttr} font-size="${labelFontSize}" fill="${escapeSvgAttr(
        labelColor
      )}" text-anchor="end">${escapeSvgText(label)}</text>`
    : '';
  const valueSvg = value
    ? `<text x="${valueX}" y="${baseline(
        valueFontSize
      )}"${fontFamilyAttr} font-size="${valueFontSize}" fill="${escapeSvgAttr(
        valueColor
      )}" text-anchor="end">${escapeSvgText(value)}</text>`
    : '';
  const unitSvg = unit
    ? `<text x="${unitX}" y="${baseline(
        unitFontSize
      )}"${fontFamilyAttr} font-size="${unitFontSize}" fill="${escapeSvgAttr(
        unitColor
      )}" text-anchor="start">${escapeSvgText(unit)}</text>`
    : '';

  return `${labelSvg}${valueSvg}${unitSvg}`;
};

/**
 * 无法用原生图元还原的组件（自定义 Vue 组件、custom-svg 等）先光栅化，
 * 再以 <image> 内嵌为 data URI。
 *
 * 之前这里用 <foreignObject> 内嵌 XHTML，只有浏览器支持，
 * 其它 SVG 工具（Figma / Illustrator / svg-edit / 各类在线转换器）会整块丢弃。
 */
const rasterizeItem = async (item: IDoneJson, binfo: IDoneJsonBinfo): Promise<string> => {
  if (typeof document === 'undefined') return '';
  const el = document.getElementById(item.id);
  if (!el) return '';
  const width = Math.max(binfo.width, 1);
  const height = Math.max(binfo.height, 1);

  // 克隆到画布外的临时容器再截图：避免画布的缩放/平移变换影响光栅化结果的尺寸
  const holder = document.createElement('div');
  holder.setAttribute(
    'style',
    'position:fixed;left:0;top:0;z-index:-2147483647;pointer-events:none;'
  );
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.position = 'static';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.margin = '0';
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone
    .querySelectorAll('.mt-dzr-resize, .mt-dzr-rotate, .dzr-active, .mt-dzr-rotate-bg')
    .forEach((node) => node.remove());
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: null,
      scale: 2,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      useCORS: true,
      logging: false
    });
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl || dataUrl === 'data:,') return '';
    return `<image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" href="${dataUrl}" xlink:href="${dataUrl}"></image>`;
  } catch (e) {
    console.warn('图元光栅化失败，已跳过该图元', item.id, e);
    return '';
  } finally {
    holder.remove();
  }
};

const buildMarkers = (items: IDoneJson[]): string => {
  let result = '';
  for (const item of items) {
    if (item.type === 'sys-line') {
      const stroke = escapeSvgAttr(String(getProp(item, 'stroke', '#ffffff')));
      const id = escapeSvgAttr(item.id);
      result += `<marker id="markerArrowStart${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${stroke}"></path></marker>`;
      result += `<marker id="markerArrowEnd${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${stroke}"></path></marker>`;
    }
    if (item.type === 'group') result += buildMarkers(getChildren(item));
  }
  return result;
};

/**
 * 渲染符号图元：把 <symbol> 的内容原样铺到画布上——保持图元自身坐标，
 * 只把「放置位置 + viewBox 缩放」写成 transform 下推到每个图元。
 *
 * 不使用 <symbol>/<use>/嵌套 <svg>，也不套 <g>：这些写法在 svg-edit、Figma、
 * Illustrator 等工具里常被整块丢弃或丢失变换，表现为“图标看不到 / 位置不对”。
 */
const renderSymbol = (item: IDoneJson, binfo: IDoneJsonBinfo, itemTransform: string): string => {
  const symbol = item.symbol;
  if (!symbol?.symbol_id || !symbol.symbol_str) return '';
  const nodes = parseSymbolMarkup(symbol.symbol_str, getInheritedPaint(item.props));
  if (!nodes.length) return '';
  const viewBox = parseViewBox(
    getSymbolViewBox(symbol.symbol_str, symbol.width, symbol.height),
    symbol.width,
    symbol.height
  );
  const scaleXExact = binfo.width / viewBox.width;
  const scaleYExact = binfo.height / viewBox.height;
  // 先按精确比例算平移量再四舍五入，避免 viewBox 带负数原点时出现 20.001 这类误差
  const scaleX = round(scaleXExact);
  const scaleY = round(scaleYExact);
  const translateX = round(-viewBox.minX * scaleXExact);
  const translateY = round(-viewBox.minY * scaleYExact);
  const symbolTransform = [
    translateX || translateY ? `translate(${translateX}, ${translateY})` : '',
    `scale(${scaleX}, ${scaleY})`
  ]
    .filter(Boolean)
    .join(' ');
  return flattenElements(nodes, composeTransform(itemTransform, symbolTransform));
};

const renderItem = async (item: IDoneJson, parentSize?: ParentSize): Promise<string> => {
  if (item.hide) return '';

  const binfo = getLocalBinfo(item, parentSize);
  const { left, top, width, height, angle } = binfo;
  const rotate = angle ? ` rotate(${angle}, ${width / 2}, ${height / 2})` : '';
  const itemTransform = [left || top ? `translate(${left}, ${top})` : '', rotate.trim()]
    .filter(Boolean)
    .join(' ');
  const wrap = (inner: string) => `<g transform="${itemTransform}">${inner}</g>`;

  switch (item.type) {
    case 'svg':
      // 图标不再套 <g>：变换直接写在每个图元上，结构最扁平、最容易被导入工具还原
      return renderSymbol(item, binfo, itemTransform);
    case 'group': {
      const parts: string[] = [];
      for (const child of getChildren(item)) {
        const part = await renderItem(child, { width, height });
        if (part) parts.push(part);
      }
      return wrap(parts.join(''));
    }
    case 'sys-line': {
      const points = (item.props.point_position?.val ?? []) as { x: number; y: number }[];
      if (!points.length) return '';
      const electricity = String(getProp(item, 'ani_type', '')) === 'electricity';
      const stroke = String(
        electricity ? getProp(item, 'ani_color', '#ffffff') : getProp(item, 'stroke', '#ffffff')
      );
      const strokeWidth = getNumberProp(item, 'stroke-width', 2);
      const markerStart = isTruthy(getProp(item, 'marker-start', false))
        ? ` marker-start="url(#markerArrowStart${escapeSvgAttr(item.id)})"`
        : '';
      const markerEnd = isTruthy(getProp(item, 'marker-end', false))
        ? ` marker-end="url(#markerArrowEnd${escapeSvgAttr(item.id)})"`
        : '';
      // dasharray 为 0 时直接省略，部分渲染器会把 0 当作“隐藏线”
      const dasharray = electricity ? ` stroke-dasharray="${strokeWidth * 3}"` : '';
      return wrap(
        `<path d="${escapeSvgAttr(
          positionArrarToPath(points, 0, 0)
        )}" fill="none" stroke="${escapeSvgAttr(
          stroke
        )}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dasharray}${markerStart}${markerEnd}></path>`
      );
    }
    case 'img':
      return item.thumbnail
        ? wrap(
            `<image x="0" y="0" width="${width}" height="${height}" href="${escapeSvgAttr(
              item.thumbnail
            )}" xlink:href="${escapeSvgAttr(item.thumbnail)}" preserveAspectRatio="none"></image>`
          )
        : '';
    case 'vue':
      if (item.props.text !== undefined) return wrap(renderText(item));
      if (item.tag?.startsWith('busbar-')) return wrap(renderBusbar(item, binfo));
      if (item.tag === 'card-vue') return wrap(renderCardVue(item, binfo));
      if (item.tag === 'kv-vue') return wrap(renderKvVue(item, binfo));
      return wrap(await rasterizeItem(item, binfo));
    case 'custom-svg':
      return wrap(await rasterizeItem(item, binfo));
    default:
      return '';
  }
};

export const genVectorSvg = async (): Promise<string> => {
  const items = globalStore.done_json ?? [];
  const cfg = globalStore.canvasCfg;
  const width = cfg.width || 1280;
  const height = cfg.height || 734;

  const defs = buildMarkers(items);
  const bodyParts: string[] = [];
  for (const item of items) {
    const part = await renderItem(item);
    if (part) bodyParts.push(part);
  }
  const body = bodyParts.join('');
  const background = `<rect width="${width}" height="${height}" fill="${escapeSvgAttr(
    cfg.color || '#000000'
  )}"></rect>`;
  const backgroundImage = cfg.img
    ? `<image x="0" y="0" width="${width}" height="${height}" href="${escapeSvgAttr(
        cfg.img
      )}" xlink:href="${escapeSvgAttr(cfg.img)}" preserveAspectRatio="xMidYMid slice"></image>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${defs ? `<defs>${defs}</defs>` : ''}
${background}
${backgroundImage}
${body}
</svg>
`;
};
