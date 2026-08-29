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
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * Vue's v-bind() CSS variables are written to an ancestor of the canvas.
 * Copy the resolved variables into the exported XHTML root so the cloned
 * canvas keeps its dimensions, background and transform-related styles.
 */
const copyInheritedCssVariables = (source: HTMLElement, target: HTMLElement) => {
  const variables = new Map<string, string>();

  // Inline variables are the important part here (the canvas dimensions are
  // generated this way), while walking ancestors also preserves inherited
  // theme variables such as the Element Plus colors.
  for (let current: HTMLElement | null = source; current; current = current.parentElement) {
    for (let index = 0; index < current.style.length; index += 1) {
      const property = current.style.item(index);
      if (property.startsWith('--') && !variables.has(property)) {
        variables.set(property, current.style.getPropertyValue(property));
      }
    }
  }

  // Include variables coming from computed styles as a fallback for themes
  // that do not expose their values through inline styles.
  const computedStyle = window.getComputedStyle(source);
  for (let index = 0; index < computedStyle.length; index += 1) {
    const property = computedStyle.item(index);
    if (property.startsWith('--') && !variables.has(property)) {
      variables.set(property, computedStyle.getPropertyValue(property));
    }
  }

  variables.forEach((value, property) => {
    target.style.setProperty(property, value);
  });
};

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
 * 生成画布 SVG 缩略图并下载
 *
 * 优先基于画布数据（done_json + canvasCfg）直接构建轻量原生矢量 SVG：
 * 纯 <symbol>/<use>/<text>/<path> 图元，不含页面框架的 CSS 变量与样式表，
 * 体积小、兼容性好（任何 SVG 渲染器都能打开），与图一（method-draw-image.svg）同类。
 *
 * 仅当画布数据为空（非编辑态导出）时，才回退到旧的 foreignObject 内嵌 DOM 快照方案，
 * 以保证画面完整。
 *
 * @param canvas_id 画布 DOM id，默认为 mtCanvasArea
 */
export const useGenSvgThumbnail = async (canvas_id: string = 'mtCanvasArea') => {
  // 优先走数据驱动矢量导出
  try {
    const vectorSvg = genVectorSvg();
    if (vectorSvg && globalStore.done_json?.length) {
      downloadSvg(vectorSvg);
      return;
    }
  } catch (e) {
    // 矢量导出异常时降级到 DOM 快照
    console.warn('矢量 SVG 导出失败，降级为 DOM 快照', e);
  }

  // 兜底：DOM 快照 + foreignObject
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
  // 收集页面内所有 CSS 规则，保证克隆节点在独立 SVG 中也能正确渲染
  let cssText = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        cssText += rule.cssText + '\n';
      }
    } catch (e) {
      // 跨域样式表无法读取，跳过
      console.warn('读取样式表失败，已跳过', e);
    }
  }
  const clone = el.cloneNode(true) as HTMLElement;
  // 缩略图应反映画布本身，而不是当前的缩放、平移视图
  clone.style.transform = 'none';
  clone.style.transformOrigin = '0 0';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  // 保留 #mt-edit 根节点的 id/class，使基于其作用域的 CSS 变量与选择器在 SVG 内继续生效
  const root = el.closest('#mt-edit') as HTMLElement | null;
  const wrapper = document.createElementNS(XHTML_NS, 'div') as HTMLDivElement;
  wrapper.setAttribute('id', 'mt-edit');
  if (root) {
    wrapper.setAttribute('class', root.getAttribute('class') || '');
  }
  copyInheritedCssVariables(el, wrapper);

  // Put the stylesheet inside the XHTML subtree. This keeps HTML selectors
  // and scoped Vue styles effective when the downloaded SVG is opened alone.
  const style = document.createElementNS(XHTML_NS, 'style');
  style.textContent = cssText;
  wrapper.appendChild(style);
  wrapper.appendChild(clone);

  // Build the document with namespace-aware DOM APIs instead of concatenating
  // raw markup. That prevents the XHTML subtree from being parsed as SVG.
  const svgDocument = document.implementation.createDocument(SVG_NS, 'svg', null);
  const svg = svgDocument.documentElement;
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const foreignObject = svgDocument.createElementNS(SVG_NS, 'foreignObject');
  foreignObject.setAttribute('x', '0');
  foreignObject.setAttribute('y', '0');
  foreignObject.setAttribute('width', `${width}`);
  foreignObject.setAttribute('height', `${height}`);
  foreignObject.appendChild(svgDocument.importNode(wrapper, true));
  svg.appendChild(foreignObject);

  const svgContent = new XMLSerializer().serializeToString(svgDocument);
  downloadSvg(svgContent);
};
