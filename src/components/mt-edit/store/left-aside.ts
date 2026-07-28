import { reactive } from 'vue';
import type { ILeftAside, ILeftAsideConfigItemPublic, ILeftAsideConfigItem } from './types';
import { ElMessage } from 'element-plus';
import { svgToSymbol } from '../utils';
import { configStore } from './config';

export const leftAsideStore: ILeftAside = reactive({
  config: new Map<string, ILeftAsideConfigItem[]>([
    ['系统组件', configStore.sysComponent],
    ['一次设备', configStore.grid],
    ['电网', configStore.gridClass],
    ['新能源', configStore.newEnergy],
    ['储能', configStore.storage],
    ['负荷', configStore.load],
    ['通信辅助', configStore.comm]
  ]),
  registerConfig: (
    title: string,
    config: ILeftAsideConfigItemPublic[],
    options: { inheritSvgPaint?: boolean; replaceExisting?: boolean } = {}
  ) => {
    if (title == '系统组件') {
      ElMessage.info(`title:${title}已被系统占用，请更换名称！`);
      return;
    }

    const cfg: ILeftAsideConfigItem[] = config.map((m) => {
      if (m.type == 'svg') {
        const { symbol_str, width, height } = svgToSymbol(m.svg!, m.id, {
          inheritPaint: options.inheritSvgPaint
        });
        return {
          ...m,
          symbol: {
            symbol_id: m.id,
            symbol_str,
            width,
            height
          },
          common_animations: {
            val: '',
            delay: 'delay-0s',
            speed: 'slow',
            repeat: 'infinite'
          }
        };
      }
      return {
        ...m,
        common_animations: {
          val: '',
          delay: 'delay-0s',
          speed: 'slow',
          repeat: 'infinite'
        }
      };
    });
    // 分类已存在时追加合并；需要时可按 id 替换已注册项，便于开发环境热更新生效。
    if (leftAsideStore.config.has(title)) {
      const exist = leftAsideStore.config.get(title)!;
      const existIds = new Set(exist.map((i) => i.id));
      const cfgById = new Map(cfg.map((item) => [item.id, item]));
      const mergedExist = options.replaceExisting
        ? exist.map((item) => cfgById.get(item.id) ?? item)
        : exist;
      leftAsideStore.config.set(title, [
        ...mergedExist,
        ...cfg.filter((item) => !existIds.has(item.id))
      ]);
    } else {
      leftAsideStore.config.set(title, cfg);
    }
  },
  removeConfigItem: (title: string, itemId: string) => {
    const config = leftAsideStore.config.get(title);
    if (!config) return;
    leftAsideStore.config.set(
      title,
      config.filter((item) => item.id !== itemId)
    );
  },
  removeConfigGroup: (title: string) => {
    leftAsideStore.config.delete(title);
  }
});
