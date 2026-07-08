export interface StationDiagram {
  id: string;
  name: string;
  thumbnail: string;
  exportJson: Record<string, unknown>;
  createTime: number;
  /** 最新更新时间：首次创建时等于创建时间，后续每次更新时刷新为当前修改时间 */
  updateTime: number;
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
