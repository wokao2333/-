import { describe, expect, it } from 'vitest';
import { symbolGenSvg } from './index';
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
