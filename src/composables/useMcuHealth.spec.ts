import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkMcuHealth, getMcuBaseUrl, mcuHealthPath } from './useMcuHealth';

const mockFetch = (impl: (input: string) => Promise<unknown>) => {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
};

const okResponse = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getMcuBaseUrl', () => {
  it('拼接 IP 与端口', () => {
    expect(getMcuBaseUrl({ ip: '192.168.79.11', port: '9998' })).toBe('http://192.168.79.11:9998');
  });

  it('未配置端口时省略端口', () => {
    expect(getMcuBaseUrl({ ip: '192.168.79.11' })).toBe('http://192.168.79.11');
  });

  it('未配置 IP 时返回空串', () => {
    expect(getMcuBaseUrl(null)).toBe('');
    expect(getMcuBaseUrl({ port: '9998' })).toBe('');
  });
});

describe('checkMcuHealth', () => {
  it('业务码为 200 时视为可达并返回版本与时间', async () => {
    const fn = mockFetch(() =>
      okResponse({
        code: 200,
        msg: '操作成功',
        data: { version: '1.1.0', serverTime: '2026-11-25 15:00:00' }
      })
    );

    const result = await checkMcuHealth('http://192.168.79.11:9998');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBe(`http://192.168.79.11:9998${mcuHealthPath}`);
    expect(result).toEqual({
      ok: true,
      version: '1.1.0',
      serverTime: '2026-11-25 15:00:00'
    });
  });

  it('业务码非 200 时视为不可达', async () => {
    mockFetch(() => okResponse({ code: 401, msg: '未授权', data: null }));

    const result = await checkMcuHealth('http://192.168.79.11:9998');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('未授权');
  });

  it('HTTP 状态异常时视为不可达', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 502 } as Response));

    const result = await checkMcuHealth('http://192.168.79.11:9998');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('HTTP 502');
  });

  it('网络异常时视为不可达', async () => {
    mockFetch(() => Promise.reject(new Error('Failed to fetch')));

    const result = await checkMcuHealth('http://192.168.79.11:9998');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Failed to fetch');
  });

  it('未配置地址时不发起请求', async () => {
    const fn = mockFetch(() => okResponse({ code: 200 }));

    const result = await checkMcuHealth('');

    expect(fn).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});
