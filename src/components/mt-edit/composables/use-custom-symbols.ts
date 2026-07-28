import { onMounted, shallowRef } from 'vue';
import db, { type CustomSymbolRow } from '@/database';
import { svgToImgSrc } from '@/components/mt-edit/utils';
import { leftAsideStore } from '@/components/mt-edit/store/left-aside';
import type { ILeftAsideConfigItemPublic } from '@/components/mt-edit/store/types';

export const DEFAULT_CUSTOM_SYMBOL_CATEGORY = '自定义分类';
export const DEFAULT_CUSTOM_SYMBOL_COLOR = '#ff1500';

export type CustomSymbolDraft = Omit<CustomSymbolRow, 'createTime' | 'updateTime'> & {
  createTime?: number;
  updateTime?: number;
};

const withDefaultColorProps = (
  props: ILeftAsideConfigItemPublic['props'] | undefined
): ILeftAsideConfigItemPublic['props'] => ({
  fill: {
    title: '图元颜色',
    type: 'color',
    val: DEFAULT_CUSTOM_SYMBOL_COLOR
  },
  ...(props ?? {})
});

const toPublicConfig = (row: CustomSymbolRow): ILeftAsideConfigItemPublic => ({
  id: row.id,
  title: row.title,
  type: 'svg',
  thumbnail: svgToImgSrc(row.svg),
  svg: row.svg,
  props: withDefaultColorProps(row.props),
  device: row.device,
  attachLabel: row.attachLabel
});

const registerRows = (rows: CustomSymbolRow[]) => {
  const grouped = new Map<string, ILeftAsideConfigItemPublic[]>();
  for (const row of rows) {
    const category = row.category.trim() || DEFAULT_CUSTOM_SYMBOL_CATEGORY;
    const list = grouped.get(category) ?? [];
    list.push(toPublicConfig({ ...row, category }));
    grouped.set(category, list);
  }
  for (const [category, items] of grouped) {
    leftAsideStore.registerConfig(category, items, {
      inheritSvgPaint: true,
      replaceExisting: true
    });
  }
};

export function useCustomSymbols() {
  const symbols = shallowRef<CustomSymbolRow[]>([]);
  const loading = shallowRef(false);

  const load = async () => {
    loading.value = true;
    try {
      const rows = await db.customSymbol.list();
      symbols.value = rows;
      registerRows(rows);
      return rows;
    } finally {
      loading.value = false;
    }
  };

  const save = async (row: CustomSymbolRow) => {
    const normalizedRow = {
      ...row,
      category: row.category.trim() || DEFAULT_CUSTOM_SYMBOL_CATEGORY,
      props: withDefaultColorProps(row.props)
    };
    await db.customSymbol.save(normalizedRow);
    const index = symbols.value.findIndex((item) => item.id === normalizedRow.id);
    const next = [...symbols.value];
    if (index >= 0) next.splice(index, 1, normalizedRow);
    else next.push(normalizedRow);
    symbols.value = next;
    registerRows([normalizedRow]);
    return normalizedRow;
  };

  const remove = async (symbolId: string, options: { removeEmptyCategory?: boolean } = {}) => {
    const target = symbols.value.find((item) => item.id === symbolId);
    await db.customSymbol.remove(symbolId);
    if (target) {
      leftAsideStore.removeConfigItem(target.category, symbolId);
      if (options.removeEmptyCategory && leftAsideStore.config.get(target.category)?.length === 0) {
        leftAsideStore.removeConfigGroup(target.category);
      }
    }
    symbols.value = symbols.value.filter((item) => item.id !== symbolId);
    return target;
  };

  const removeCategory = async (category: string) => {
    const categorySymbols = symbols.value.filter((item) => item.category === category);
    await db.customSymbol.removeByCategory(category);
    for (const symbol of categorySymbols) {
      leftAsideStore.removeConfigItem(category, symbol.id);
    }
    leftAsideStore.removeConfigGroup(category);
    symbols.value = symbols.value.filter((item) => item.category !== category);
    return categorySymbols.length;
  };

  onMounted(() => {
    load().catch((error) => {
      console.error('加载自定义分类失败', error);
    });
  });

  return { symbols, loading, load, save, remove, removeCategory };
}
