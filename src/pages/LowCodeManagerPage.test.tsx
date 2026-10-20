import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import LowCodeManagerPage from './LowCodeManagerPage';
import { api } from '../lowcode/api';
import { readTemplateDraft } from '../lowcode/template-draft';

const act: typeof import('react-dom/test-utils').act = (React as any).act;
const mockNavigate = jest.fn();
const originalCrypto = globalThis.crypto;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children }: any) => <span>{children}</span>,
}), { virtual: true });
jest.mock('../lowcode/api', () => ({
  api: { list: jest.fn(), activeComponents: jest.fn(), components: jest.fn(), create: jest.fn() },
}));
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Select: ({ options, onChange }: any) => (
    <select onChange={event => onChange(event.target.value)} defaultValue="">
      <option value="">选择组件</option>
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}));

let host: HTMLDivElement;
let root: Root;

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
  jest.clearAllMocks();
  sessionStorage.clear();
  (api.list as jest.Mock).mockResolvedValue([]);
  (api.activeComponents as jest.Mock).mockResolvedValue([
    { componentName: 'input', version: '1.2.0', metadata: { lowcode: { displayName: '输入框' } } },
    { componentName: 'button', version: '2.0.0' },
  ]);
  (api.create as jest.Mock).mockResolvedValue({ id: 'config:input:1.2.0', kind: 'config' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
});

test('creating a template opens a local draft without creating a server record', async () => {
  await act(async () => root.render(<LowCodeManagerPage kind="templates" />));
  await act(async () => host.querySelector('button')!.click());
  expect(api.create).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith('/manage/templates/t123456781234');
  expect(readTemplateDraft('t123456781234')?.title).toBe('新模板');
});

test('configuration choices use active components and hide versions while preserving their identity', async () => {
  await act(async () => root.render(<LowCodeManagerPage kind="component-configs" />));
  expect(api.activeComponents).toHaveBeenCalledTimes(1);
  expect(api.components).not.toHaveBeenCalled();
  const select = host.querySelector('select')!;
  expect(Array.from(select.options).map(option => option.text)).toEqual(['选择组件', '输入框', 'button']);
  await act(async () => {
    select.value = 'input:1.2.0';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => host.querySelector('button')!.click());
  expect(api.create).toHaveBeenCalledWith('component-configs', expect.objectContaining({ id: 'input:1.2.0' }));
});
