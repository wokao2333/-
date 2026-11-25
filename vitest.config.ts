import { fileURLToPath } from 'node:url';
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config';
import type { ConfigEnv, UserConfig } from 'vite';
import viteConfig from './vite.config';

// vite.config.ts 以回调形式（mode 相关）导出配置，这里先解析成纯配置对象再合并，
// 否则 mergeConfig 会因 “Cannot merge config in form of callback” 直接报错。
export default defineConfig(async (env) => {
  const baseConfig =
    typeof viteConfig === 'function'
      ? await (viteConfig as (configEnv: ConfigEnv) => UserConfig | Promise<UserConfig>)(env)
      : viteConfig;

  return mergeConfig(baseConfig, {
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/*'],
      root: fileURLToPath(new URL('./', import.meta.url))
    }
  });
});
