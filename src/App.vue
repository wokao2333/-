<script setup lang="ts">
import { leftAsideStore } from '@/export';
const electrical_modules_files = import.meta.glob('./assets/svgs/electrical/**/*.svg', {
  eager: true,
  as: 'raw'
});
const electrical_stroke_modules_files = import.meta.glob(
  './assets/svgs/electrical/stroke/**/*.svg',
  {
    eager: true,
    as: 'raw'
  }
);
const electrical_register_config: any = [];
for (const key in electrical_modules_files) {
  if (key.includes('/stroke/')) continue;
  //根据路径获取svg文件名
  const name = key.split('/').pop()!.split('.')[0];
  electrical_register_config.push({
    id: name,
    title: name,
    type: 'svg',
    thumbnail: 'data:image/svg+xml;utf8,' + encodeURIComponent(electrical_modules_files[key]),
    svg: electrical_modules_files[key],
    props: {
      fill: {
        type: 'color',
        val: '#FF0000',
        title: '填充色'
      }
    }
  });
}
for (const key in electrical_stroke_modules_files) {
  //根据路径获取svg文件名
  const name = key.split('/').pop()!.split('.')[0];
  // 用 copy 版本替代原始版本，但保留原标题
  if (name === '隔离开关') continue;
  const titleMap: Record<string, string> = {
    '隔离开关 copy': '隔离开关'
  };
  const title = titleMap[name] || name;
  const rawSvg = electrical_stroke_modules_files[key] as string;
  // 画布 symbol 用去掉显式黑色填充的版本，使 <use> 能统一着色为红色
  let symbolSvg = rawSvg;
  if (name === '隔离开关 copy') {
    symbolSvg = rawSvg.replace(/fill="#000000"/g, '').replace(/fill-opacity="1"/g, '');
  }
  electrical_register_config.push({
    id: title,
    title: title,
    type: 'svg',
    thumbnail: 'data:image/svg+xml;utf8,' + encodeURIComponent(rawSvg),
    svg: symbolSvg,
    props: {
      stroke: {
        type: 'color',
        val: '#FF0000',
        title: '边框色'
      }
    }
  });
}
// 保留的电气符号白名单
const electrical_keep_list = new Set([
  '电力-电流互感器',
  '电力-站用变压器',
  '电力-双铁芯双绕组电流互感器_右',
  '接地',
  '电力-避雷器1',
  '电力-避雷器2',
  '双绕组变压器',
  '隔离开关',
  'ATS',
  '开关手车'
]);
leftAsideStore.registerConfig(
  '电气符号',
  electrical_register_config.filter((item: any) => electrical_keep_list.has(item.title))
);

</script>

<template>
  <router-view></router-view>
</template>

<style scoped></style>
