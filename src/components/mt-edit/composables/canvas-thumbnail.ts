import { Canvg } from 'canvg';
import html2canvas from 'html2canvas';
import { ElMessage } from 'element-plus';

/**
 * 生成画布截图并返回 base64 图片地址
 * @param canvas_id 画布 DOM id，默认为 mtCanvasArea
 * @returns base64 图片地址
 */
export const genCanvasDataUrl = async (canvas_id: string = 'mtCanvasArea'): Promise<string> => {
  const el = <HTMLElement | null>document.querySelector(`#${canvas_id}`);
  if (!el) {
    ElMessage.error('没有找到 canvas 元素，请检查！');
    return '';
  }
  // 记录要移除的 svg 元素
  const shouldRemoveSvgNodes: HTMLCanvasElement[] = [];
  // 获取到所有的 SVG 得到一个数组，目前只有自定义连线需要特殊处理，别的元素直接使用 html2canvas 就可以
  const svgElements: NodeListOf<HTMLElement> = document.body.querySelectorAll(
    `#${canvas_id} .mt-line-render`
  );
  // 遍历这个数组
  for (const item of svgElements) {
    // 去除空白字符
    const svg = item.outerHTML.trim();
    // 创建一个 canvas DOM 元素
    const canvas = document.createElement('canvas');
    // 设置 canvas 元素的宽高
    canvas.width = item.getBoundingClientRect().width;
    canvas.height = item.getBoundingClientRect().height;
    const ctx = canvas.getContext('2d');
    // 将 SVG 转化成 canvas
    const v = Canvg.fromString(ctx!, svg);
    await v.render();

    // 设置生成 canvas 元素的坐标，保证与原 SVG 坐标保持一致
    if (item.style.position) {
      canvas.style.position += item.style.position;
      canvas.style.left += item.style.left;
      canvas.style.top += item.style.top;
    }

    // 添加到需要截图的 DOM 节点中
    item.parentNode!.appendChild(canvas);
    // 删除这个元素
    shouldRemoveSvgNodes.push(canvas);
  }

  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const canvas = await html2canvas(el, {
    useCORS: true,
    scale: 2,
    width,
    height,
    allowTaint: true,
    windowHeight: height,
    logging: false,
    ignoreElements: (element) => {
      if (element.classList.contains('mt-line-render')) {
        return true;
      }
      return false;
    }
  });
  const dataUrl = canvas.toDataURL('image/png');
  // 移除需要移除掉的 svg 节点
  shouldRemoveSvgNodes.forEach((item) => {
    item.remove();
  });
  return dataUrl;
};
