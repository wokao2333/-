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
  /**
   * 绑定的 MCU 设备 ID（关联 mcus.id）。
   * 一次图可绑定一个所属场站下的 MCU，用于关联该图与具体设备；未绑定时为空。
   */
  boundMcuId?: string;
  /**
   * 绑定的 MCU 详细信息快照（SN / IP / 端口 / 备注等）。
   * 绑定时把选中 MCU 的详细信息一并写入一次图，便于离线展示与追溯，
   * 即使原 MCU 后续被修改或删除，仍能保留绑定当时的信息。
   */
  boundMcuInfo?: McuItem | null;
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
  remark?: string;
  diagrams: StationDiagram[];
}

export interface StationForm {
  name: string;
  address: string;
  remark: string;
}

/**
 * 场站绑定的 MCU 设备。
 * SN / IP / 通信端口等连接信息仅关联于 MCU 实体，
 * 与场站彻底解耦：一个场站可包含多个独立 MCU，数据通过 stationId 按场站隔离。
 */
export interface McuItem {
  id: string;
  /** 所属场站 ID，用于按场站隔离绑定关系 */
  stationId: string;
  /** SN 号，必填 */
  sn: string;
  /** IP 地址 */
  ip?: string;
  /** 通信端口 */
  port?: string;
  /** 备注 */
  remark?: string;
  /**
   * 最近更新时间（毫秒时间戳）。
   * 每次对该记录编辑并成功保存时，自动写入当前系统时间，
   * 以准确反映最后一次编辑完成时间。
   */
  updateTime: number;
}
