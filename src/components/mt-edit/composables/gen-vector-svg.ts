import { globalStore } from '../store/global';
import { genDomPropstr, positionArrarToPath } from '../utils/index';
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

const symbolDefs = new Map<string, string>();

const collectSymbolDefs = (items: IDoneJson[]) => {
  for (const item of items) {
    if (item.type === 'svg' && item.symbol?.symbol_id && item.symbol.symbol_str) {
      if (!symbolDefs.has(item.symbol.symbol_id)) {
        symbolDefs.set(item.symbol.symbol_id, item.symbol.symbol_str);
      }
    }
    if (item.type === 'group') collectSymbolDefs(getChildren(item));
  }
};

const renderText = (item: IDoneJson) => {
  const fontSize = getNumberProp(item, 'fontSize', 15);
  const fontFamily = String(getProp(item, 'fontFamily', ''));
  const fill = String(getProp(item, 'fill', '#000000') || '#000000');
  const text = String(getProp(item, 'text', ''));
  const vertical = isTruthy(getProp(item, 'vertical', false));
  if (!text) return '';

  const fontFamilyAttr = fontFamily ? ` font-family="${escapeSvgAttr(fontFamily)}"` : '';
  const verticalAttrs = vertical
    ? ' writing-mode="tb" letter-spacing="5" dominant-baseline="hanging"'
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

  const labelSvg = label
    ? `<text x="0" y="${lineY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="bold" fill="${escapeSvgAttr(
        labelColor
      )}" dominant-baseline="middle">${escapeSvgText(label)}</text>`
    : '';
  const lineSvg =
    lineX < width
      ? `<line x1="${lineX}" y1="${lineY}" x2="${width}" y2="${lineY}" stroke="${escapeSvgAttr(
          stroke
        )}" stroke-width="${strokeWidth}" stroke-linecap="butt"></line>`
      : '';

  return `${labelSvg}${lineSvg}`;
};

const renderCardVue = (item: IDoneJson, binfo: IDoneJsonBinfo): string => {
  const { width, height } = binfo;
  const background = String(getProp(item, 'backGroundColor', 'rgba(2, 28, 15, 0.34)'));
  const borderColor = String(getProp(item, 'borderColor', '#35c94a'));
  const shadow = String(getProp(item, 'shadow', 'always'));
  const boxShadow = String(getProp(item, 'boxShadow', 'rgba(53, 201, 74, 0.18)'));
  const x = width * 0.025;
  const y = height * 0.025;
  const cardWidth = width * 0.95;
  const cardHeight = height * 0.95;
  const filterId = `cardShadow-${item.id}`;
  const filter = shadow === 'always' ? ` filter="url(#${escapeSvgAttr(filterId)})"` : '';
  const filterDef =
    shadow === 'always'
      ? `<defs><filter id="${escapeSvgAttr(
          filterId
        )}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"></feGaussianBlur><feFlood flood-color="${escapeSvgAttr(
          boxShadow
        )}" result="color"></feFlood><feComposite in="color" in2="blur" operator="in" result="shadow"></feComposite><feMerge><feMergeNode in="shadow"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs>`
      : '';

  return `${filterDef}<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="0" ry="0" fill="${escapeSvgAttr(
    background
  )}" stroke="${escapeSvgAttr(borderColor)}" stroke-width="1"${filter}></rect>`;
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

const renderForeignObject = (item: IDoneJson, binfo: IDoneJsonBinfo): string => {
  const el = document.getElementById(item.id);
  if (!el) return '';
  const node = el.cloneNode(true) as HTMLElement;
  node.style.transform = 'none';
  node.style.position = 'relative';
  node.style.left = '0';
  node.style.top = '0';
  node.style.width = `${binfo.width}px`;
  node.style.height = `${binfo.height}px`;
  node
    .querySelectorAll('.mt-dzr-resize, .mt-dzr-rotate, .dzr-active, .mt-dzr-rotate-bg')
    .forEach((element) => element.remove());

  const css = collectCssForNode(node);
  const html = node.outerHTML
    .replace(/<svg/gi, '<svg xmlns="http://www.w3.org/2000/svg"')
    .replace(/^<(div|span|p)([^>]*)/i, (_, tag, rest) => {
      return `<${tag} xmlns="http://www.w3.org/1999/xhtml"${rest}`;
    });

  return `<foreignObject x="0" y="0" width="${binfo.width}" height="${binfo.height}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${html}</div></foreignObject>`;
};

const collectCssForNode = (node: HTMLElement): string => {
  const usedClasses = new Set<string>();
  node.classList.forEach((className) => usedClasses.add(className));
  node
    .querySelectorAll('*')
    .forEach((child) => child.classList.forEach((className) => usedClasses.add(className)));

  let cssText = '';
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        const keep = rule.selectorText
          .split(',')
          .some((selector) =>
            [...usedClasses].some((className) =>
              new RegExp(`\\.${escapeRegExp(className)}\\b`).test(selector)
            )
          );
        if (keep) cssText += `${rule.cssText}\n`;
      }
    } catch {
      // Cross-origin stylesheets cannot be read and are not essential to a fallback export.
    }
  }
  return cssText;
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

const renderItem = (item: IDoneJson, parentSize?: ParentSize): string => {
  if (item.hide) return '';

  const binfo = getLocalBinfo(item, parentSize);
  const { left, top, width, height, angle } = binfo;
  const rotate = angle ? ` rotate(${angle}, ${width / 2}, ${height / 2})` : '';
  const wrap = (inner: string) => `<g transform="translate(${left}, ${top})${rotate}">${inner}</g>`;

  switch (item.type) {
    case 'svg': {
      const symbol = item.symbol;
      if (!symbol?.symbol_id) return '';
      const props = genDomPropstr(item.props).replace(
        /(stroke|fill)="([^"]*)"/g,
        'stroke="$2" fill="$2"'
      );
      const viewBox = getSymbolViewBox(symbol.symbol_str, symbol.width, symbol.height);
      return wrap(
        `<svg x="0" y="0" width="${width}" height="${height}" viewBox="${escapeSvgAttr(
          viewBox
        )}" preserveAspectRatio="none"><use xlink:href="#${escapeSvgAttr(
          symbol.symbol_id
        )}" ${props} x="0" y="0" width="100%" height="100%"></use></svg>`
      );
    }
    case 'group': {
      const children = getChildren(item)
        .map((child) => renderItem(child, { width, height }))
        .filter(Boolean)
        .join('');
      return wrap(children);
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
      const dasharray = electricity ? strokeWidth * 3 : 0;
      return wrap(
        `<path d="${escapeSvgAttr(
          positionArrarToPath(points, 0, 0)
        )}" fill="none" stroke="${escapeSvgAttr(
          stroke
        )}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dasharray}"${markerStart}${markerEnd}></path>`
      );
    }
    case 'img':
      return item.thumbnail
        ? wrap(
            `<image x="0" y="0" width="${width}" height="${height}" xlink:href="${escapeSvgAttr(
              item.thumbnail
            )}" preserveAspectRatio="none"></image>`
          )
        : '';
    case 'vue':
      if (item.props.text !== undefined) return wrap(renderText(item));
      if (item.tag?.startsWith('busbar-')) return wrap(renderBusbar(item, binfo));
      if (item.tag === 'card-vue') return wrap(renderCardVue(item, binfo));
      if (item.tag === 'kv-vue') return wrap(renderKvVue(item, binfo));
      return wrap(renderForeignObject(item, binfo));
    case 'custom-svg':
      return wrap(renderForeignObject(item, binfo));
    default:
      return '';
  }
};

export const genVectorSvg = (): string => {
  symbolDefs.clear();
  const items = globalStore.done_json ?? [];
  const cfg = globalStore.canvasCfg;
  const width = cfg.width || 1280;
  const height = cfg.height || 750;

  collectSymbolDefs(items);
  const defs = [
    ...[...symbolDefs.values()].map((symbol) => symbol.replace(/ xmlns="[^"]*"/, '')),
    buildMarkers(items)
  ]
    .filter(Boolean)
    .join('\n');
  const body = items
    .map((item) => renderItem(item))
    .filter(Boolean)
    .join('');
  const background = `<rect width="${width}" height="${height}" fill="${escapeSvgAttr(
    cfg.color || '#000000'
  )}"></rect>`;
  const backgroundImage = cfg.img
    ? `<image x="0" y="0" width="${width}" height="${height}" xlink:href="${escapeSvgAttr(
        cfg.img
      )}" preserveAspectRatio="xMidYMid slice"></image>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${defs}</defs>
  ${background}
  ${backgroundImage}
  ${body}
</svg>
`;
};
