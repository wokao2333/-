let text_measure_canvas: HTMLCanvasElement | undefined;

export const measureTextWidth = (text: string, font_size: number, font_family: string) => {
  if (!text) {
    return 0;
  }
  if (typeof document !== 'undefined') {
    text_measure_canvas ||= document.createElement('canvas');
    const context = text_measure_canvas.getContext('2d');
    if (context) {
      context.font = `${font_size}px ${font_family}`;
      return context.measureText(text).width;
    }
  }
  return Array.from(text).reduce(
    (width, character) => width + (/[^\x00-\xff]/.test(character) ? font_size : font_size * 0.56),
    0
  );
};

export const getTextBoxWidth = (
  text: string,
  font_size: number,
  font_family: string,
  horizontal_padding = 8
) => Math.max(1, Math.ceil(measureTextWidth(text, font_size, font_family) + horizontal_padding));
