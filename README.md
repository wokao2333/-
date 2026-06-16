# maotu-webtopo

`maotu-webtopo` 是一个基于 Vue 3 和 Vite 的 Web 组态编辑器项目，可用于电力拓扑、低代码大屏、可视化拖拽编辑器等场景。项目既可以作为演示应用运行，也可以通过库模式构建后在其他 Vue 项目中复用核心组件。

## 功能特性

- 画布式拖拽、缩放、旋转与元素选中编辑。
- 支持组态编辑、预览和基础渲染能力。
- 内置 SVG 图元、图标资源和自定义组件示例。
- 集成 Element Plus、UnoCSS、ECharts、Ace Editor、animate.css 等常用前端能力。
- 支持作为组件库构建，导出 `MtEdit`、`MtPreview`、`MtDzr` 等组件。
- 支持 TypeScript 类型产物生成，便于在业务项目中集成。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Element Plus
- UnoCSS
- ECharts / vue-echarts
- vite-plugin-svg-icons
- vite-plugin-dts

## 环境要求

建议使用以下环境：

- Node.js 18+
- pnpm 8+

## 快速开始

安装依赖：

```bash
pnpm install
```

启动开发服务：

```bash
pnpm dev
```

构建演示应用：

```bash
pnpm build
```

本地预览构建结果：

```bash
pnpm preview
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 格式化 `src` 后启动 Vite 开发服务 |
| `pnpm build` | 类型检查并构建应用 |
| `pnpm preview` | 预览生产构建结果 |
| `pnpm test:unit` | 运行 Vitest 单元测试 |
| `pnpm type-check` | 运行 Vue TypeScript 类型检查 |
| `pnpm lint` | 执行 ESLint 修复 |
| `pnpm format` | 使用 Prettier 格式化 `src` |
| `pnpm lib` | 以库模式构建 `maotu` |
| `pnpm npm` | 以 npm 发布模式构建 |

## 目录结构

```text
.
├── public/                         # 静态资源
├── src/
│   ├── assets/                     # 图片、图标、SVG 图元和样式资源
│   ├── components/
│   │   ├── custom-components/      # 自定义业务组件
│   │   ├── mt-dzr/                 # 拖拽缩放旋转核心组件
│   │   ├── mt-edit/                # 组态编辑器
│   │   ├── mt-preview/             # 组态预览组件
│   │   └── test/                   # 示例组件
│   ├── router/                     # 路由配置
│   ├── views/                      # 页面视图
│   ├── export.ts                   # 组件库导出入口
│   └── main.ts                     # 演示应用入口
├── vite.config.ts                  # Vite 配置
├── uno.config.ts                   # UnoCSS 配置
└── package.json
```

## 作为组件库使用

先构建库产物：

```bash
pnpm lib
```

构建完成后会生成 `dist` 目录，主要产物包括：

- `dist/maotu.es.js`
- `dist/maotu.umd.js`
- `dist/style.css`
- `dist/src/**/*.d.ts`

在业务项目中引入：

```vue
<script setup lang="ts">
import { MtEdit, MtPreview, MtDzr } from 'maotu';
import 'maotu/dist/style.css';
</script>

<template>
  <div class="editor-page">
    <MtEdit />
  </div>
</template>

<style scoped>
.editor-page {
  width: 100%;
  height: 100vh;
}
</style>
```

如果尚未发布到 npm，也可以把 `dist` 目录复制到业务项目中，通过本地路径导入：

```ts
import { MtEdit } from '@/lib/maotu/maotu.es';
import '@/lib/maotu/style.css';
```

## 导出内容

当前库入口 `src/export.ts` 导出以下内容：

- `MtEdit`：组态编辑器主组件。
- `MtPreview`：组态预览组件。
- `MtDzr`：拖拽、缩放、旋转基础组件。
- `leftAsideStore`：左侧面板相关状态。

## SVG 与图元资源

项目内置资源主要位于：

- `src/assets/icons`：用于 `vite-plugin-svg-icons` 注册的图标。
- `src/assets/svgs`：组态编辑器可使用的 SVG 图元资源。
- `src/assets/imgs`：图片资源。

新增 SVG 图标后，开发服务会通过 `vite-plugin-svg-icons` 统一注册为 symbol，默认 ID 格式为 `mt-edit-[name]`。

## 开发说明

- 项目使用 `@` 指向 `src` 目录。
- 开发命令 `pnpm dev` 会先执行 `pnpm format`，因此启动前会自动格式化 `src`。
- 库模式构建入口为 `src/export.ts`。
- `vite.config.ts` 中库模式会将 `vue` 外部化，业务项目需要自行安装 Vue。

## 许可证

本项目使用 `LGPL-3.0` 协议。

- 可以将本项目作为库链接到商业项目中，商业项目本身无需因此开源。
- 如果修改了本项目核心库代码并分发修改后的版本，需要按照 LGPL-3.0 协议开放对应修改。
- 如果只是作为依赖使用，且没有分发修改后的源码，则业务项目无需开源。

完整许可证内容请查看 [LICENSE](./LICENSE) 或 [GNU LGPL-3.0](https://www.gnu.org/licenses/lgpl-3.0.html)。

## 鸣谢

项目部分拖拽、缩放、旋转和低代码编辑器思路参考了以下内容：

- [幽月之格：可拖拽、缩放、旋转组件实现细节](https://juejin.cn/user/3597257779449165/posts)
- [woai3c/visual-drag-demo](https://github.com/woai3c/visual-drag-demo)
