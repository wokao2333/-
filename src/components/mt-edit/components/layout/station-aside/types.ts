export interface StationDiagram {
  id: string;
  name: string;
  /** 备注信息，可为空 */
  remark?: string;
  thumbnail: string;
  exportJson: Record<string, unknown>;
  /** 已绑定设备图元数量 */
  boundDeviceCount: number;
  /** 未绑定设备图元数量 */
  unboundDeviceCount: number;
  /** 是否已发布到微电网项目 */
  published: boolean;
  createTime: number;
  /** 最新更新时间：首次创建时等于创建时间，后续每次更新时刷新为当前修改时间 */
  updateTime: number;
}

/** 新增一次接线图时弹窗表单提交的数据 */
export interface AddDiagramPayload {
  stationId: string;
  name: string;
  remark: string;
}

export interface Station {
  id: string;
  name: string;
  address: string;
  sn?: string;
  ip?: string;
  port?: string;
  baseUrl?: string;
  remark?: string;
  diagrams: StationDiagram[];
}

export interface StationForm {
  name: string;
  address: string;
  sn: string;
  ip: string;
  port: string;
  baseUrl: string;
  remark: string;
}

/** 场站绑定的 MCU 设备 */
export interface McuItem {
  id: string;
  /** 所属场站 ID，用于按场站隔离绑定关系 */
  stationId: string;
  /** SN 号，必填 */
  sn: string;
  /** IP 地址 */
  ip?: string;
  /** 备注 */
  remark?: string;
  /** 最近更新时间（毫秒时间戳） */
  updateTime: number;
}
