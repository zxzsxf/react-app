import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { Grid, Modal } from 'antd';
import { LocalAIChatPage as AIChatPage } from '../../pages/AIChatPage';
import { api, ApiError, Snapshot } from '../../lowcode/api';
import { AuthProvider, RequireAuth } from '../../lowcode/Auth';
import { generate, simulateDraft } from '../../ai-chat/mock-generator';
import { GenerateInput } from '../../ai-chat/types';

const act: typeof import('react-dom/test-utils').act = (React as any).act;
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/ai-chat' }),
  Navigate: ({ to }: any) => <div>跳转：{to}</div>,
}), { virtual: true });

jest.mock('../../lowcode/MobileRenderer', () => ({
  LowCodeRenderer: ({ schema, locks, formRef }: any) => {
    jest.requireActual('react').useImperativeHandle(formRef, () => ({ submit: async () => ({ name: '张三' }) }));
    return <div data-preview={JSON.stringify({ schema, locks })}>真实预览接口</div>;
  },
}));

jest.mock('../../ai-chat/mock-generator', () => ({
  ...jest.requireActual('../../ai-chat/mock-generator'),
  generate: jest.fn(),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Select: ({ options, onChange, value, disabled, 'aria-label': label }: any) => (
    <select aria-label={label} disabled={disabled} value={value || ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">请选择</option>
      {options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}));

const config: Snapshot = {
  id: 'input:1', title: '输入框配置', version: 2,
  schema: { type: 'object', properties: {} }, componentLocks: {}, bindings: {},
};
const template: Snapshot = {
  id: 'customer', title: '客户模板', version: 3,
  schema: { type: 'object', properties: { person: { type: 'string', title: '姓名', 'x-component': 'Input' } } },
  componentLocks: { Input: { remoteName: 'input', version: 'old', configVersion: 1 } },
  bindings: {},
};

let host: HTMLDivElement;
let root: Root;
const mount = (element: React.ReactNode) => root.render(element);
const originalCrypto = globalThis.crypto;
const button = (text: string) => Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.replace(/\s/g, '').includes(text))!;
const click = async (text: string) => act(async () => { button(text).click(); });
const change = async (selector: string, value: string) => act(async () => {
  const element = host.querySelector(selector)!;
  Simulate.change(element, { target: { value } } as any);
});
const send = async (text: string) => {
  await change('textarea', text);
  await click('发送');
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addListener() {}, removeListener() {} }),
  });
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
  });
  jest.spyOn(Grid, 'useBreakpoint').mockReturnValue({ lg: true });
  jest.spyOn(Modal, 'confirm').mockReturnValue({ destroy: jest.fn(), update: jest.fn() });
  jest.spyOn(api, 'activeComponents').mockResolvedValue([{ componentName: 'input', version: '1' }]);
  jest.spyOn(api, 'components').mockResolvedValue([{
    componentName: 'input', version: '1',
    manifest: {
      schemaComponent: 'Input', displayName: '输入框', kind: 'field', allowedProps: ['placeholder'],
      defaultFieldSchema: { type: 'string', 'x-component': 'Input' },
    },
  }]);
  jest.spyOn(api, 'list').mockResolvedValue([{ id: 'template:customer', title: '客户模板', publishedVersion: 3 } as any]);
  jest.spyOn(api, 'published').mockImplementation(async (kind) => kind === 'templates' ? template : config);
  jest.spyOn(api, 'create').mockResolvedValue({ id: 'form:f123456781234123412341234' } as any);
  jest.spyOn(api, 'get').mockRejectedValue(new ApiError('不存在', 404));
  (generate as jest.Mock).mockImplementation(async function* (input: GenerateInput) {
    yield { type: 'text_delta', text: '模拟完成' };
    const draft = simulateDraft(input.message, input.currentDraft);
    if (draft) {
      yield { type: 'draft', draft };
    }
    yield { type: 'done' };
  });
  mockNavigate.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.restoreAllMocks();
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
});

test('blank generation previews real schema and saves it without templateId before opening the builder', async () => {
  await act(async () => mount(<AIChatPage />));
  expect(host.textContent).toContain('模拟生成');
  await send('生成姓名、手机号组成的登记表');
  await send('添加备注字段');
  const preview = JSON.parse(host.querySelector('[data-preview]')!.getAttribute('data-preview')!);
  expect(preview.schema.properties.remark.title).toBe('备注');
  expect(preview.locks.Input).toMatchObject({ version: '1', configVersion: 2 });
  expect(host.textContent).toContain('候选 v2');
  await click('校验并查看表单值');
  expect(host.textContent).toContain('张三');
  await click('保存并继续编辑');
  const payload = (api.create as jest.Mock).mock.calls[0][1];
  expect(payload.templateId).toBeUndefined();
  expect(payload.schema.properties.remark.title).toBe('备注');
  expect(mockNavigate).toHaveBeenCalledWith(`/form-builder/${payload.id}`);
});

test('template switching requires confirmation and uses its pinned published version', async () => {
  await act(async () => mount(<AIChatPage />));
  await send('生成登记表');
  await change('select[aria-label="起步方式"]', 'template');
  expect(Modal.confirm).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('模拟完成');
  const confirmation = (Modal.confirm as jest.Mock).mock.calls[0][0];
  await act(async () => { confirmation.onOk(); });
  await change('select[aria-label="已发布模板"]', 'customer');
  expect(api.published).toHaveBeenCalledWith('templates', 'customer');
  expect(host.textContent).not.toContain('模拟完成');
  await send('将姓名设为必填');
  const preview = JSON.parse(host.querySelector('[data-preview]')!.getAttribute('data-preview')!);
  expect(preview.schema.properties.person.required).toBe(true);
  expect(preview.locks.Input.version).toBe('old');
  expect(template.schema.properties!.person.required).toBeUndefined();
});

test('a save response lost on the network locks the snapshot and retry checks the existing document', async () => {
  (api.create as jest.Mock).mockRejectedValueOnce(new TypeError('网络中断'));
  await act(async () => mount(<AIChatPage />));
  await send('生成登记表');
  await click('保存并继续编辑');
  expect(host.textContent).toContain('网络中断');
  expect((host.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true);
  (api.get as jest.Mock).mockResolvedValueOnce({ id: 'form:existing' });
  await click('重试保存');
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('forms', expect.any(String));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

test('Enter respects IME composition and Shift+Enter, and the example inserts a prompt', async () => {
  await act(async () => mount(<AIChatPage />));
  await click('添加邮箱字段');
  expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('添加邮箱字段');
  const textarea = host.querySelector('textarea')!;
  act(() => {
    Simulate.compositionStart(textarea);
    Simulate.keyDown(textarea, { key: 'Enter', nativeEvent: { isComposing: true } } as any);
    Simulate.compositionEnd(textarea);
    Simulate.keyDown(textarea, { key: 'Enter', shiftKey: true, nativeEvent: {} } as any);
  });
  expect(generate).not.toHaveBeenCalled();
  await click('发送');
  expect(generate).toHaveBeenCalledTimes(1);
});

test('missing configs exclude Input and show a useful failure without creating invalid fields', async () => {
  (api.published as jest.Mock).mockRejectedValue(new ApiError('尚未发布配置', 404));
  await act(async () => mount(<AIChatPage />));
  expect(host.textContent).toContain('没有可用 Input');
  await send('生成登记表');
  expect(host.textContent).toContain('当前起步配置没有可用 Input');
  const preview = JSON.parse(host.querySelector('[data-preview]')!.getAttribute('data-preview')!);
  expect(preview.schema.properties).toEqual({});
});

test.each([
  [null, '跳转：/login'],
  [{ id: 'c', username: 'client', roles: ['C'], csrf: 'token' }, '没有访问权限'],
  [{ id: 'b', username: 'builder', roles: ['B'], csrf: 'token' }, '受保护的AI页面'],
])('the AI route guard respects the authenticated role: %j', async (user, expected) => {
  jest.spyOn(api, 'me').mockImplementation(async () => {
    if (!user) {
      throw new ApiError('未登录', 401);
    }
    return user as any;
  });
  await act(async () => mount(
    <AuthProvider><RequireAuth roles={['B']}><div>受保护的AI页面</div></RequireAuth></AuthProvider>,
  ));
  expect(host.textContent).toContain(expected);
});
