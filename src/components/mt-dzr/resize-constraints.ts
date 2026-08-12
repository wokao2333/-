import type { IDoneJson, IDoneJsonBinfo } from '@/components/mt-edit/store/types';

/** 图元最多缩小到初始尺寸的一半，避免文字换行和预览不可读。 */
export const DEFAULT_RESIZE_MIN_SCALE = 0.5;

export type ResizeBaseSize = Pick<IDoneJsonBinfo, 'width' | 'height'>;

const rememberedBaseSizes = new Map<string, ResizeBaseSize>();

const isPositiveFinite = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

const normalizeBaseSize = (size: unknown): ResizeBaseSize | undefined => {
  if (!size || typeof size !== 'object') return undefined;
  const { width, height } = size as Partial<ResizeBaseSize>;
  if (!isPositiveFinite(width) || !isPositiveFinite(height)) return undefined;
  return { width, height };
};

const getCurrentSize = (binfo: IDoneJsonBinfo): ResizeBaseSize => ({
  width: isPositiveFinite(binfo.width) ? binfo.width : 1,
  height: isPositiveFinite(binfo.height) ? binfo.height : 1
});

export const createResizeBaseSize = (binfo: IDoneJsonBinfo): ResizeBaseSize => {
  return getCurrentSize(binfo);
};

/**
 * Returns the stable size used as the minimum-size reference.
 * Legacy items without persisted metadata are remembered by id for the current session.
 */
export const getResizeBaseSize = (item: Pick<IDoneJson, 'id' | 'binfo' | 'resize_base_size'>) => {
  const persisted = normalizeBaseSize(item.resize_base_size);
  if (persisted) return persisted;

  const remembered = rememberedBaseSizes.get(item.id);
  if (remembered) return remembered;

  const current = getCurrentSize(item.binfo);
  rememberedBaseSizes.set(item.id, current);
  return current;
};

export const getResizeMinScale = (item: Pick<IDoneJson, 'resize_min_scale'>) => {
  const value = Number(item.resize_min_scale);
  return isPositiveFinite(value) ? Math.min(1, Math.max(0.05, value)) : DEFAULT_RESIZE_MIN_SCALE;
};

export const getResizeMinSize = (
  item: Pick<IDoneJson, 'id' | 'binfo' | 'resize_base_size' | 'resize_min_scale'>
): ResizeBaseSize => {
  const base = getResizeBaseSize(item);
  const scale = getResizeMinScale(item);
  return {
    width: base.width * scale,
    height: base.height * scale
  };
};

export const clampResizeDimension = (value: unknown, minimum: number) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(minimum, numericValue) : minimum;
};

/** Adds stable resize metadata to top-level canvas items without changing their current size. */
export const normalizeResizeBaseSizes = (
  items: IDoneJson[],
  legacyCurrentIsMinimum = false
): IDoneJson[] => {
  return items.map((item) => {
    const persisted = normalizeBaseSize(item.resize_base_size);
    const current = getCurrentSize(item.binfo);
    const scale = getResizeMinScale(item);
    const base =
      persisted ??
      (legacyCurrentIsMinimum
        ? { width: current.width / scale, height: current.height / scale }
        : current);
    return {
      ...item,
      resize_base_size: base
    };
  });
};
