import { Canvg } from 'canvg';
import html2canvas from 'html2canvas';
import { ElMessage } from 'element-plus';
import { genVectorSvg } from './gen-vector-svg';
import { globalStore } from '../store/global';
export const useGenThumbnail = async (canvas_id: string = 'mtCanvasArea') => {
  const el = <HTMLElement | null>document.querySelector(`#${canvas_id}`);
  if (!el) {
    ElMessage.error('没有找到canvas元素,请检查！');
    return;
  }
  //记录要移除的svg元素
  const shouldRemoveSvgNodes = [];
  // 获取到所有的SVG 得到一个数组 目前只有自定义连线需要特殊处理 别的元素直接使用html2canvas就可以
  const svgElements: NodeListOf<HTMLElement> = document.body.querySelectorAll(
    `#${canvas_id} .mt-line-render`
  );
  // 遍历这个数组
  for (const item of svgElements) {
    //去除空白字符
    const svg = item.outerHTML.trim();
    // 创建一个 canvas DOM元素
    const canvas = document.createElement('canvas');
    //设置 canvas 元素的宽高
    canvas.width = item.getBoundingClientRect().width;
    canvas.height = item.getBoundingClientRect().height;
    const ctx = canvas.getContext('2d');
    // 将 SVG转化 成 canvas
    const v = Canvg.fromString(ctx!, svg);
    await v.render();

    //设置生成 canvas 元素的坐标  保证与原SVG坐标保持一致
    if (item.style.position) {
      canvas.style.position += item.style.position;
      canvas.style.left += item.style.left;
      canvas.style.top += item.style.top;
    }

    //添加到需要截图的DOM节点中
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
  const img_link = document.createElement('a');
  img_link.href = canvas.toDataURL('image/png'); // 转换后的图片地址
  img_link.download = Date.now().toString();
  document.body.appendChild(img_link);
  // 触发点击
  img_link.click();
  // 然后移除
  document.body.removeChild(img_link);
  // 移除需要移除掉的svg节点
  shouldRemoveSvgNodes.forEach((item) => {
    item.remove();
  });
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 下载一段 SVG 字符串为独立 .svg 文件
 */
const downloadSvg = (svgContent: string) => {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img_link = document.createElement('a');
  img_link.href = url;
  img_link.download = `${Date.now()}.svg`;
  document.body.appendChild(img_link);
  // 触发点击
  img_link.click();
  // 然后移除
  document.body.removeChild(img_link);
  // Give the browser a chance to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * 把整块画布光栅化成 PNG data URI（连线等内联 SVG 先用 canvg 转成 canvas）。
 * 用于矢量导出不可用时的兜底，保证兜底产物依然是“纯 SVG”。
 */
const rasterizeCanvasElement = async (el: HTMLElement, width: number, height: number) => {
  const replaced: { canvas: HTMLCanvasElement; svg: HTMLElement }[] = [];
  for (const svgItem of Array.from(el.querySelectorAll<HTMLElement>('.mt-line-render'))) {
    try {
      const rect = svgItem.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await Canvg.fromString(ctx, svgItem.outerHTML.trim()).render();
      canvas.style.cssText = svgItem.getAttribute('style') || '';
      svgItem.style.display = 'none';
      svgItem.parentNode?.appendChild(canvas);
      replaced.push({ canvas, svg: svgItem });
    } catch (e) {
      console.warn('连线光栅化失败，已跳过', e);
    }
  }

  try {
    const canvas = await html2canvas(el, {
      useCORS: true,
      scale: 2,
      width,
      height,
      allowTaint: true,
      windowHeight: height,
      logging: false,
      ignoreElements: (element) => element.classList.contains('mt-line-render')
    });
    return canvas.toDataURL('image/png');
  } finally {
    replaced.forEach(({ canvas, svg }) => {
      canvas.remove();
      svg.style.display = '';
    });
  }
};

/**
 * 生成画布 SVG 并下载
 *
 * 导出结果是“纯 SVG”：只包含 svg / defs / marker / rect / path / line / text / image 等
 * 标准图元，不使用 <foreignObject>、<symbol>、<use>、页面 CSS 类名或外部地址，
 * 因此导入 Figma、Illustrator、svg-edit 或各类在线 SVG 工具时不会丢元素。
 *
 * 无法用图元还原的组件会被光栅化后以 <image> 内嵌，仍然是单文件 SVG。
 *
 * @param canvas_id 画布 DOM id，默认为 mtCanvasArea
 */
export const useGenSvgThumbnail = async (canvas_id: string = 'mtCanvasArea') => {
  // 优先走数据驱动矢量导出
  try {
    const vectorSvg = await genVectorSvg();
    if (vectorSvg && globalStore.done_json?.length) {
      downloadSvg(vectorSvg);
      return;
    }
  } catch (e) {
    // 矢量导出异常时降级到画布快照
    console.warn('矢量 SVG 导出失败，降级为画布快照', e);
  }

  // 兜底：整块画布光栅化后内嵌为 <image>，不引入 foreignObject
  const el = <HTMLElement | null>document.querySelector(`#${canvas_id}`);
  if (!el) {
    ElMessage.error('没有找到canvas元素,请检查！');
    return;
  }
  const width = el.offsetWidth || el.clientWidth;
  const height = el.offsetHeight || el.clientHeight;
  if (!width || !height) {
    ElMessage.error('画布尺寸无效，无法导出 SVG');
    return;
  }

  const dataUrl = await rasterizeCanvasElement(el, width, height);
  if (!dataUrl) {
    ElMessage.error('导出 SVG 失败，请重试');
    return;
  }
  downloadSvg(
    `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image x="0" y="0" width="${width}" height="${height}" href="${dataUrl}" xlink:href="${dataUrl}" preserveAspectRatio="none"></image></svg>`
  );
};
