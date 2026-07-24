const ATS_SOURCE_COLOR = '#000000';

/**
 * ATS 是多色图元：原黑色部分跟随可编辑的 color，绿色状态标识保留原色。
 * stroke 改为小写 currentcolor，避免 svgToSymbol 对普通 currentColor stroke 的清理。
 */
export const prepareAtsCanvasSvg = (rawSvg: string): string =>
  rawSvg
    .replace(new RegExp(`stroke="${ATS_SOURCE_COLOR}"`, 'gi'), 'style="stroke:currentcolor"')
    .replace(new RegExp(`fill="${ATS_SOURCE_COLOR}"`, 'gi'), 'fill="currentColor"');
