import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { Grid } from 'antd';
import RemoteAIChatPage from '../../pages/AIChatPage/RemoteAIChatPage';
import { aiApi, AISession } from '../../ai-chat/api';
import { api } from '../../lowcode/api';

const act: typeof import('react-dom/test-utils').act = (React as any).act;
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/ai-chat', search: '?sessionId=session-1' };
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}), { virtual: true });
jest.mock('../../lowcode/MobileRenderer', () => ({
  LowCodeRenderer: ({ schema }: any) => <div data-schema={JSON.stringify(schema)}>表单预览组件</div>,
}));

let host: HTMLDivElement;
let root: Root;
let session: AISession;
const button = (text: string) => Array.from(host.querySelectorAll('button')).find(item =>
  item.textContent?.replace(/\s/g, '').includes(text),
)!;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addListener() {}, removeListener() {} }),
  });
  session = {
    id: 'session-1', title: '历史会话', source: { mode: 'blank', templateId: '' }, revision: 3, activeRunId: null,
    draft: {
      title: '登记表', schema: { type: 'object', properties: {} }, componentLocks: {},
    },
  };
  jest.spyOn(Grid, 'useBreakpoint').mockReturnValue({ lg: true });
  jest.spyOn(aiApi, 'capabilities').mockResolvedValue({ provider: 'openai-compatible', configured: true, components: ['Input'] });
  jest.spyOn(aiApi, 'list').mockResolvedValue({ items: [{ ...session, updatedAt: '2026-10-21' }], total: 1 });
  jest.spyOn(aiApi, 'get').mockImplementation(async () => session);
  jest.spyOn(aiApi, 'messages').mockResolvedValue({ items: [
    { id: 'u1', role: 'user', content: '之前的需求', status: 'complete', runId: 'r1' },
    { id: 'a1', role: 'assistant', content: '之前的回复', status: 'complete', runId: 'r1' },
  ], nextBefore: null });
  jest.spyOn(api, 'list').mockResolvedValue([]);
  mockNavigate.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.restoreAllMocks();
});

test('restores the URL session, messages, draft and authoritative version', async () => {
  await act(async () => root.render(<RemoteAIChatPage />));
  expect(aiApi.get).toHaveBeenCalledWith('session-1');
  expect(host.textContent).toContain('之前的回复');
  expect(host.textContent).toContain('候选 v3');
  expect((host.querySelector('input[aria-label="表单名称"]') as HTMLInputElement).value).toBe('登记表');
  expect(button('保存并继续编辑').disabled).toBe(false);
});

test('missing model configuration clearly disables sending', async () => {
  (aiApi.capabilities as jest.Mock).mockResolvedValue({ provider: 'openai-compatible', configured: false, components: ['Input'] });
  await act(async () => root.render(<RemoteAIChatPage />));
  expect(host.textContent).toContain('模型尚未配置');
  expect((host.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true);
});

test('interrupted history exposes manual resume and active history blocks a second send', async () => {
  session.lastRun = {
    id: 'r1', sessionId: session.id, status: 'interrupted', prompt: '生成', reply: '', error: '重启中断',
    assistantMessageId: 'a1', userMessageId: 'u1', resultDraft: null, resultRevision: null,
  };
  await act(async () => root.render(<RemoteAIChatPage />));
  expect(button('恢复生成').disabled).toBe(false);
  session = { ...session, activeRunId: 'r1', lastRun: { ...session.lastRun!, status: 'running' } };
  await act(async () => { button('刷新会话').click(); });
  expect(button('停止任务').disabled).toBe(false);
  expect((host.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true);
});

test('saves an edited restored draft through the existing lowcode form endpoint', async () => {
  jest.spyOn(aiApi, 'title').mockImplementation(async (_id, title) => ({ ...session, revision: 4, draft: { ...session.draft, title } }));
  jest.spyOn(api, 'create').mockResolvedValue({ id: 'form:new' } as any);
  const original = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
  });
  try {
    await act(async () => root.render(<RemoteAIChatPage />));
    await act(async () => {
      Simulate.change(host.querySelector('input[aria-label="表单名称"]')!, { target: { value: '手动标题' } } as any);
    });
    await act(async () => { button('保存并继续编辑').click(); });
    expect(aiApi.title).toHaveBeenCalledWith(session.id, '手动标题', 3);
    expect(api.create).toHaveBeenCalledWith('forms', expect.objectContaining({ title: '手动标题', bindings: {} }));
    expect(mockNavigate).toHaveBeenCalledWith('/form-builder/f123456781234123412341234');
  } finally {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: original });
  }
});
