const ATS_SOURCE_COLOR = '#000000';
const FILLED_GEOMETRY_SELECTOR = 'path,rect,circle,ellipse,polygon,polyline';

/**
 * <use> 会同时注入 fill 和 stroke 以支持可换色图元。一次设备中用填充几何表示的
 * 2px 线条不应继承这个 stroke，否则会变成 3px。只保护本身有填充且没有描边的图形，
 * 明确的空心描边仍由原 SVG 控制。
 */
export const protectFilledGeometryFromInheritedStroke = (rawSvg: string): string => {
  const document = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
  if (document.querySelector('parsererror')) return rawSvg;

  document.querySelectorAll<SVGElement>(FILLED_GEOMETRY_SELECTOR).forEach((element) => {
    const fill = element.getAttribute('fill')?.trim().toLowerCase();
    const stroke = element.getAttribute('stroke')?.trim().toLowerCase();
    if (fill && fill !== 'none' && fill !== 'transparent' && (!stroke || stroke === 'none')) {
      element.style.stroke = 'none';
    }
  });

  return new XMLSerializer().serializeToString(document.documentElement);
};

/**
 * ATS 是多色图元：原黑色部分跟随可编辑的 color，绿色状态标识保留原色。
 * stroke 改为小写 currentcolor，避免 svgToSymbol 对普通 currentColor stroke 的清理。
 */
export const prepareAtsCanvasSvg = (rawSvg: string): string =>
  rawSvg
    .replace(new RegExp(`stroke="${ATS_SOURCE_COLOR}"`, 'gi'), 'style="stroke:currentcolor"')
    .replace(new RegExp(`fill="${ATS_SOURCE_COLOR}"`, 'gi'), 'fill="currentColor"');
