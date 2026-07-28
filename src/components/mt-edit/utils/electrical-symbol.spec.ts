import { describe, expect, it } from 'vitest';
import { svgToSymbol, symbolGenSvg } from './index';
import { prepareAtsCanvasSvg } from './electrical-symbol';

describe('ATS canvas symbol colors', () => {
  it('maps only black shapes to currentColor and preserves green shapes', () => {
    const svg = prepareAtsCanvasSvg(
      '<svg><rect stroke="#000000"/><path fill="#000000"/><path fill="#5ABF38"/></svg>'
    );

    expect(svg).toContain('style="stroke:currentcolor"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg).toContain('fill="#5ABF38"');
    expect(svg).not.toContain('="#000000"');
  });

  it('uses color without adding a global fill to the ATS use element', () => {
    const svg = symbolGenSvg('ATS', '<symbol id="ATS"/>', '44', '44', ' color="#FF0000"');

    expect(svg).toContain('color="#FF0000"');
    expect(svg).not.toContain('fill="#FF0000"');
  });
});

describe('uploaded SVG canvas colors', () => {
  it('lets fixed fill and stroke colors inherit from the use element', () => {
    const { symbol_str } = svgToSymbol(
      `<svg viewBox="0 0 20 20">
        <path fill="#000000" stroke="currentColor" d="M0 0h10v10z" />
        <path fill="none" stroke="url(#paint)" style="stroke-width: 2;" d="M0 0h5v5z" />
      </svg>`,
      'custom-symbol',
      { inheritPaint: true }
    );

    expect(symbol_str).not.toContain('#000000');
    expect(symbol_str).not.toContain('stroke="currentColor"');
    expect(symbol_str).toContain('fill="none"');
    expect(symbol_str).toContain('stroke="url(#paint)"');
  });
});
