// 浏览器内 SQLite（sql.js）的持久化后端：把整个 .sqlite 二进制存到 OPFS 真实文件。
// 相比原来的 IndexedDB blob 方案，这里用的是浏览器的 Origin Private File System，
// 数据库是 OPFS 里的一个真实文件，刷新/关闭/Electron 打包后都在，刷新不会丢失。
// 依赖 Chromium 内核（Electron 渲染进程、Chrome/Edge 均支持）；OPFS 不可用时返回 null 降级为内存库。

const FILE_NAME = 'maotu.sqlite';

function getRoot(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) {
    return Promise.reject(new Error('当前环境不支持 OPFS'));
  }
  return navigator.storage.getDirectory();
}

/** 读取已持久化的 .sqlite 文件；不存在或 OPFS 不可用时返回 null */
export async function loadBytes(): Promise<ArrayBuffer | null> {
  try {
    const root = await getRoot();
    const fh = await root.getFileHandle(FILE_NAME, { create: false });
    const file = await fh.getFile();
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}

/** 把整个 .sqlite 文件写入 OPFS（覆盖式） */
export async function saveBytes(buf: ArrayBuffer): Promise<void> {
  const root = await getRoot();
  const fh = await root.getFileHandle(FILE_NAME, { create: true });
  const writable = await fh.createWritable();
  await writable.write(buf);
  await writable.close();
}
