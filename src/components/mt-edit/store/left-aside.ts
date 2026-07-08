import { getCurrentInstance, reactive } from 'vue';
import type { ILeftAside, ILeftAsideConfigItemPublic, ILeftAsideConfigItem } from './types';
import { ElMessage } from 'element-plus';
import { svgToSymbol } from '../utils';
import { configStore } from './config';

export const leftAsideStore: ILeftAside = reactive({
  config: new Map<string, ILeftAsideConfigItem[]>([
    ['系统组件', configStore.sysComponent],
    ['电网及一次设备', configStore.grid],
    ['新能源', configStore.newEnergy],
    ['储能', configStore.storage],
    ['负荷', configStore.load],
    ['通信辅助', configStore.comm],
    ['系统图元', configStore.sysPrimitive]
  ]),
  registerConfig: (title: string, config: ILeftAsideConfigItemPublic[]) => {
    if (title == '系统组件') {
      ElMessage.info(`title:${title}已被系统占用，请更换名称！`);
      return;
    }

    const cfg: ILeftAsideConfigItem[] = config.map((m) => {
      if (m.type == 'svg') {
        const { symbol_str, width, height } = svgToSymbol(m.svg!, m.id);
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
    // 分类已存在时追加合并（按 id 去重），避免覆盖原有图元
    if (leftAsideStore.config.has(title)) {
      const exist = leftAsideStore.config.get(title)!;
      const existIds = new Set(exist.map((i) => i.id));
      leftAsideStore.config.set(title, [...exist, ...cfg.filter((i) => !existIds.has(i.id))]);
    } else {
      leftAsideStore.config.set(title, cfg);
    }
  }
});
