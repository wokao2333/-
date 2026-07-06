export interface StationDiagram {
  id: string;
  name: string;
  thumbnail: string;
  exportJson: Record<string, unknown>;
  createTime: number;
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
