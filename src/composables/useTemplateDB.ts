import type { TemplateItem } from '@/components/mt-edit/components/layout/template-aside/types';
import db from '@/database';

// 兼容旧调用方式；实际数据库实现由 src/database 按运行环境选择。
export function useTemplateDB() {
  const loadAll = (): Promise<TemplateItem[]> => db.template.list();

  return {
    loadAll,
    save: db.template.save,
    remove: db.template.remove
  };
}
