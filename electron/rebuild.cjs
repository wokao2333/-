/**
 * 针对 Electron 重新编译 better-sqlite3 原生模块。
 *
 * 背景：当 Node.js 架构与 Electron 架构不一致时（例如在 Apple Silicon 上
 * 通过 Rosetta 运行 x64 Node.js，但 Electron 为 arm64），
 * @electron/rebuild 会默认使用 process.arch 作为目标架构，导致编译出的
 * .node 文件架构错误，Electron 加载时报 incompatible architecture。
 *
 * 本脚本通过检测 Electron 二进制的真实架构来规避该问题。
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

// 1. 获取 Electron 版本
const electronPkg = require('electron/package.json');
const electronVersion = electronPkg.version;

// 2. 检测 Electron 二进制的真实架构
function getElectronArch() {
  if (process.platform === 'darwin') {
    const electronPath = require('electron');
    const binary = path.join(electronPath, 'Electron.app', 'Contents', 'MacOS', 'Electron');
    try {
      const out = execSync(`lipo -info "${binary}"`, { encoding: 'utf8' });
      if (out.includes('arm64')) return 'arm64';
      if (out.includes('x86_64')) return 'x64';
    } catch {
      // 检测失败时回退到 process.arch
    }
  }
  return process.arch;
}

const arch = getElectronArch();
console.log(`[rebuild] Electron ${electronVersion} / ${arch} / ${process.platform}`);

// 3. 定位 better-sqlite3 实际安装路径（兼容 pnpm 符号链接结构）
const betterSqlite3Dir = path.dirname(require.resolve('better-sqlite3/package.json'));
console.log(`[rebuild] better-sqlite3: ${betterSqlite3Dir}`);

// 4. 用 node-gyp 针对 Electron 头文件与目标架构重新编译
execSync(
  `npx node-gyp rebuild --release --target=${electronVersion} --arch=${arch} --dist-url=https://electronjs.org/headers --runtime=electron`,
  { stdio: 'inherit', cwd: betterSqlite3Dir }
);

console.log('[rebuild] 完成');
