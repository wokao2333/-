const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.resolve(__dirname, '../dist-electron');
fs.rmSync(outputDir, { recursive: true, force: true });
console.log(`[electron] 已清理打包输出目录：${outputDir}`);
