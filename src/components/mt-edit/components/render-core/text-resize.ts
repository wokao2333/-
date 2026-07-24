import type { IDoneJson, ILeftAsideConfigItemPublicProps } from '@/components/mt-edit/store/types';

type ResizeMetricKey =
  | 'fontSize'
  | 'labelFontSize'
  | 'valueFontSize'
  | 'unitFontSize'
  | 'labelWidth'
  | 'valueWidth'
  | 'unitWidth'
  | 'unitGap'
  | 'paddingX'
  | 'paddingY';

type ResizeMetricValues = Partial<Record<ResizeMetricKey, number>>;

export type ResizeVisualSnapshot = Map<string, ResizeMetricValues>;

const KV_METRIC_DEFAULTS: Record<ResizeMetricKey, number> = {
  fontSize: 15,
  labelFontSize: 0,
  valueFontSize: 0,
  unitFontSize: 0,
  labelWidth: 50,
  valueWidth: 50,
  unitWidth: 50,
  unitGap: 4,
  paddingX: 10,
  paddingY: 6
};

const KV_METRIC_TITLES: Record<ResizeMetricKey, string> = {
  fontSize: '默认文字大小',
  labelFontSize: '键名字体大小',
  valueFontSize: '键值字体大小',
  unitFontSize: '单位字体大小',
  labelWidth: '键名宽度',
  valueWidth: '键值宽度',
  unitWidth: '单位宽度',
  unitGap: '单位左间距',
  paddingX: '水平内边距',
  paddingY: '垂直内边距'
};

const KV_FONT_METRICS: ResizeMetricKey[] = [
  'fontSize',
  'labelFontSize',
  'valueFontSize',
  'unitFontSize'
];
const KV_HORIZONTAL_METRICS: ResizeMetricKey[] = [
  'labelWidth',
  'valueWidth',
  'unitWidth',
  'unitGap',
  'paddingX'
];
const KV_VERTICAL_METRICS: ResizeMetricKey[] = ['paddingY'];

const getMetricValue = (item: IDoneJson, key: ResizeMetricKey, fallback?: number) => {
  const value = Number(item.props[key]?.val ?? fallback);
  return Number.isFinite(value) ? value : undefined;
};

const roundMetric = (value: number) => Math.round(value * 100) / 100;

const scaleMetric = (initialValue: number, scale: number, isFontSize: boolean) => {
  if (initialValue === 0) return 0;
  const scaledValue = roundMetric(initialValue * scale);
  return isFontSize ? Math.max(1, scaledValue) : Math.max(0, scaledValue);
};

const createMetricProp = (
  key: ResizeMetricKey,
  currentProp: ILeftAsideConfigItemPublicProps[string] | undefined,
  value: number
) => ({
  ...(currentProp ?? {
    title: KV_METRIC_TITLES[key],
    type: 'number' as const,
    // 这两个值是组件内部布局基准，不在右侧属性面板中重复暴露。
    disabled: key === 'paddingX' || key === 'paddingY'
  }),
  val: value
});

export const collectResizeVisualMetrics = (
  item: IDoneJson,
  snapshot: ResizeVisualSnapshot = new Map()
): ResizeVisualSnapshot => {
  if (item.tag === 'text-vue') {
    const fontSize = getMetricValue(item, 'fontSize');
    if (fontSize !== undefined) {
      snapshot.set(item.id, { fontSize });
    }
  } else if (item.tag === 'kv-vue') {
    const metrics = Object.fromEntries(
      (Object.keys(KV_METRIC_DEFAULTS) as ResizeMetricKey[]).map((key) => [
        key,
        getMetricValue(item, key, KV_METRIC_DEFAULTS[key])
      ])
    ) as ResizeMetricValues;
    snapshot.set(item.id, metrics);
  }
  item.children?.forEach((child) => collectResizeVisualMetrics(child, snapshot));
  return snapshot;
};

export const scaleResizeVisualMetrics = (
  item: IDoneJson,
  snapshot: ResizeVisualSnapshot,
  width_scale: number,
  height_scale: number
): IDoneJson => {
  const initialMetrics = snapshot.get(item.id);
  const scaled_children = item.children?.map((child) =>
    scaleResizeVisualMetrics(child, snapshot, width_scale, height_scale)
  );
  const children_changed =
    scaled_children?.some((child, index) => child !== item.children?.[index]) ?? false;

  if (!initialMetrics && !children_changed) {
    return item;
  }

  const scaled_item: IDoneJson = {
    ...item,
    ...(children_changed ? { children: scaled_children } : {})
  };

  if (initialMetrics) {
    const widthScale = Number.isFinite(width_scale) ? Math.max(0, width_scale) : 1;
    const heightScale = Number.isFinite(height_scale) ? Math.max(0, height_scale) : 1;
    const props = { ...item.props };

    for (const [key, initialValue] of Object.entries(initialMetrics) as [
      ResizeMetricKey,
      number
    ][]) {
      let scale = heightScale;
      let isFontSize = key === 'fontSize';

      if (item.tag === 'text-vue') {
        scale = item.props.vertical?.val ? widthScale : heightScale;
      } else if (item.tag === 'kv-vue') {
        isFontSize = KV_FONT_METRICS.includes(key);
        if (KV_FONT_METRICS.includes(key)) {
          // 非等比缩放时以较小方向为准，防止文字从收窄后的单元格中溢出。
          scale = Math.min(widthScale, heightScale);
        } else if (KV_HORIZONTAL_METRICS.includes(key)) {
          scale = widthScale;
        } else if (KV_VERTICAL_METRICS.includes(key)) {
          scale = heightScale;
        }
      }

      props[key] = createMetricProp(
        key,
        item.props[key],
        scaleMetric(initialValue, scale, isFontSize)
      );
    }

    scaled_item.props = props;
  }

  return scaled_item;
};
