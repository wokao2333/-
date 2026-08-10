import db from '@/database';

// 统一的数据库导入/导出：整个 .sqlite 文件即“工程数据包”，
// 便于多人交接、备份与恢复。
export function useDbManager() {
  const exportDb = async (filename = 'data.sqlite') => {
    const blob = await db.project.exportFile();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDb = async (file: File) => {
    await db.project.importFile(file);
  };

  return { exportDb, importDb };
}
