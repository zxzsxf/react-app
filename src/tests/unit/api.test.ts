import { api } from '../../lowcode/api';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test('activeComponents reads the micro endpoint and preserves the active version and display metadata', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      code: 200,
      data: { input: { version: '1.2.0', metadata: { lowcode: { displayName: '输入框' } } } },
    }),
  });
  await expect(api.activeComponents()).resolves.toEqual([
    { componentName: 'input', version: '1.2.0', metadata: { lowcode: { displayName: '输入框' } } },
  ]);
  expect(global.fetch).toHaveBeenCalledWith('/micro/config/active-components', { credentials: 'same-origin' });
});

test('activeComponents reports application errors even when the HTTP request succeeds', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ code: 500, msg: '获取活跃组件失败' }),
  });
  await expect(api.activeComponents()).rejects.toThrow('获取活跃组件失败');
});
