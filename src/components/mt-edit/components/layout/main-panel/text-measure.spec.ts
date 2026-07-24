import { describe, expect, it } from 'vitest';
import { getTextBoxWidth, measureTextWidth } from './text-measure';

describe('文字选框宽度', () => {
  it('按中文实际字号估算宽度并只增加少量留白', () => {
    expect(measureTextWidth('电网', 30, '黑体')).toBe(60);
    expect(getTextBoxWidth('电网', 30, '黑体')).toBe(68);
  });

  it('空文本仍保留有效的最小宽度', () => {
    expect(getTextBoxWidth('', 30, '黑体')).toBe(8);
  });
});
