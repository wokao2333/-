import { objectDeepClone, randomString } from '../utils';
import type {
  IDoneJson,
  ILeftAsideConfigItem,
  ILeftAsideConfigItemPublicProps,
  ICommonAnimations
} from '../store/types';
import { createResizeBaseSize } from '@/components/mt-dzr/resize-constraints';

export interface TemplateKvLine {
  key: string;
  value: string;
}

/**
 * 将多行文本解析为键值对列表。
 * 每行视为一条数据；优先以第一个 : ： Tab | 作为分隔符拆分为 key/value；
 * 无分隔符的行视为“卡片标题”（值留空），便于与键值对组合成卡片式展示。
 */
export function parseTemplateLines(text: string): TemplateKvLine[] {
  const lines = (text || '').split(/\r?\n/);
  const result: TemplateKvLine[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.search(/[:：\t|]/);
    if (idx > 0) {
      result.push({ key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() });
    } else {
      result.push({ key: line, value: '' });
    }
  }
  return result;
}

/** 依据键值对图元配置生成一个 KV 图元实例（props 深拷贝，独立可变） */
export function buildKvItem(
  kvCfg: ILeftAsideConfigItem,
  line: TemplateKvLine,
  left: number,
  top: number,
  width: number,
  height: number
): IDoneJson {
  const props = objectDeepClone<ILeftAsideConfigItemPublicProps>(kvCfg.props);
  if (line.key) props.label.val = line.key;
  props.value.val = line.value;
  const common_animations = objectDeepClone<ICommonAnimations>(kvCfg.common_animations);
  const binfo = { left, top, width, height, angle: 0 };
  return {
    id: kvCfg.id + '-' + randomString(),
    title: kvCfg.title,
    type: kvCfg.type,
    binfo,
    resize_base_size: createResizeBaseSize(binfo),
    resize: true,
    rotate: true,
    lock: false,
    active: false,
    hide: false,
    props,
    tag: kvCfg.id,
    common_animations,
    events: []
  };
}

/** 将键值对按行纵向排列为一组图元 */
export function layoutKvItems(kvCfg: ILeftAsideConfigItem, lines: TemplateKvLine[]): IDoneJson[] {
  const rowH = 40;
  const gap = 8;
  const width =
    (kvCfg.props.labelWidth?.val ?? 50) +
    (kvCfg.props.valueWidth?.val ?? 50) +
    (kvCfg.props.unitWidth?.val ?? 50) +
    (kvCfg.props.unitGap?.val ?? 4);
  return lines.map((line, i) => buildKvItem(kvCfg, line, 0, i * (rowH + gap), width, rowH));
}

/**
 * 将一组图元组合为单个 group（子元素位置以百分比存储），逻辑等价于 createGroupInfo 但不依赖 DOM。
 */
export function buildGroupFromItems(items: IDoneJson[]): IDoneJson | null {
  if (!items.length) return null;
  const minLeft = Math.min(...items.map((i) => i.binfo.left));
  const minTop = Math.min(...items.map((i) => i.binfo.top));
  const maxRight = Math.max(...items.map((i) => i.binfo.left + i.binfo.width));
  const maxBottom = Math.max(...items.map((i) => i.binfo.top + i.binfo.height));
  const width = maxRight - minLeft || 1;
  const height = maxBottom - minTop || 1;
  const children = items.map((i) => ({
    ...objectDeepClone<IDoneJson>(i),
    binfo: {
      width: (100 * i.binfo.width) / width,
      height: (100 * i.binfo.height) / height,
      left: (100 * (i.binfo.left - minLeft)) / width,
      top: (100 * (i.binfo.top - minTop)) / height,
      angle: i.binfo.angle || 0
    },
    active: false
  }));
  const binfo = { left: minLeft, top: minTop, width, height, angle: 0 };
  return {
    id: 'group-' + randomString(),
    title: '组合',
    type: 'group',
    binfo,
    resize_base_size: createResizeBaseSize(binfo),
    resize: true,
    rotate: true,
    lock: false,
    active: true,
    hide: false,
    use_proportional_scaling: true,
    props: {},
    common_animations: { val: '', delay: 'delay-0s', speed: 'slow', repeat: 'infinite' },
    children,
    events: [],
    tag: 'group'
  };
}
