/**
 * MCU（EMS 服务）健康检查。
 *
 * 依据接口文档《服务健康检查接口》：
 * - 方法：`GET /business/monitor/health`
 * - 公开路由，无需 `Authorization`，不依赖 MQTT / EMS / 数据库；
 * - 成功响应体形如 `{ code: 200, msg: '操作成功', data: { version, serverTime } }`；
 * - 前端可达性探测应以 `code === 200` 判定服务可达，不要再用 `HEAD /`（根路径未注册会返回 404）。
 */

/** 健康检查接口路径 */
export const mcuHealthPath = '/business/monitor/health';

/** 健康检查成功时返回的业务码 */
export const mcuHealthSuccessCode = 200;

export interface McuHealthResult {
  /** 服务是否可达（HTTP 正常且业务码为 200） */
  ok: boolean;
  /** 服务发布版本，读取失败时后端返回 `unknown` */
  version?: string;
  /** 服务端 UTC+8 时间，格式 `yyyy-MM-dd HH:mm:ss` */
  serverTime?: string;
  /** 失败原因，便于排查（网络异常、HTTP 状态码、业务码等） */
  error?: string;
}

interface McuHealthResponse {
  code?: number;
  msg?: string;
  data?: {
    version?: string;
    serverTime?: string;
  } | null;
}

/** MCU 连接信息（IP / 通信端口） */
export interface McuConnectionInfo {
  ip?: string;
  port?: string;
}

/**
 * 由 MCU 连接信息拼接接口基地址，如 `http://192.168.79.11:9998`。
 * 未配置 IP 时返回空串，调用方据此判定“未绑定 MCU / 未配置 IP”。
 */
export const getMcuBaseUrl = (mcu?: McuConnectionInfo | null): string => {
  if (!mcu?.ip) return '';
  return `http://${mcu.ip}${mcu.port ? `:${mcu.port}` : ''}`;
};

const stringifyError = (error: unknown): string => {
  if (error instanceof DOMException && error.name === 'AbortError') return '请求超时';
  if (error instanceof Error) return error.message;
  return String(error);
};

/**
 * 探测 MCU 服务健康状态。
 * @param baseUrl MCU 接口基地址（含协议与端口）
 * @param timeout 超时时间（毫秒），默认 3000
 */
export const checkMcuHealth = async (baseUrl: string, timeout = 3000): Promise<McuHealthResult> => {
  if (!baseUrl) {
    return { ok: false, error: '未配置 MCU 地址' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    // 公开路由不需要 Token，避免会话过期被误判为服务不可达
    const response = await fetch(`${baseUrl}${mcuHealthPath}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const json = (await response.json()) as McuHealthResponse;
    if (json?.code !== mcuHealthSuccessCode) {
      return { ok: false, error: json?.msg || `业务码 ${json?.code ?? '未知'}` };
    }

    return {
      ok: true,
      version: json.data?.version,
      serverTime: json.data?.serverTime
    };
  } catch (error) {
    return { ok: false, error: stringifyError(error) };
  } finally {
    clearTimeout(timer);
  }
};
