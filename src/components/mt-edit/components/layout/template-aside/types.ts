import type { IDoneJson } from '@/components/mt-edit/store/types';

/** 单个复用模版：封装一组可拖拽复用的图元组合（如键值对、卡片等组成的 group） */
export interface TemplateItem {
  id: string;
  /** 模版名称，用于区分不同模版 */
  name: string;
  /** 模版备注，用于补充说明模版的用途 */
  remark: string;
  /** 模版内容：一个组合后的 group（含 children），拖入画布时整体实例化 */
  content: IDoneJson;
  /** 组合内图元数量（children 顶层数量），用于列表展示 */
  itemCount: number;
  /** 创建时间（毫秒时间戳） */
  createTime: number;
  /** 最近更新时间（毫秒时间戳） */
  updateTime: number;
}
