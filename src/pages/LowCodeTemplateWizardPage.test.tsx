import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import LowCodeTemplateWizardPage from './LowCodeTemplateWizardPage';
import { api } from '../lowcode/api';
import { storeTemplateDraft } from '../lowcode/template-draft';

const act: typeof import('react-dom/test-utils').act = (React as any).act;
jest.mock(
  'react-router-dom',
  () => ({ useParams: () => ({ id: 'testTemplate' }) }),
  { virtual: true },
);
jest.mock('../lowcode/api', () => ({
  api: {
    components: jest.fn(),
    activeComponents: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    get: jest.fn(),
  },
}));
jest.mock('./LowCodeFormBuilderPage', () => ({
  __esModule: true,
  default: ({ template }: any) => (
    <div data-testid="builder">
      {template.catalog.map((item: any) => item.manifest.displayName).join(',')}
    </div>
  ),
}));
const mockConfigSchema = {
  type: 'object',
  properties: {
    placeholder: { type: 'string', 'x-component': 'Input' },
  },
};
jest.mock('../lowcode/FlowformManageEditor', () => {
  const React = require('react');
  return {
    FlowformManageEditor: React.forwardRef(({ onReadyChange }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        readSchema: async () => mockConfigSchema,
      }));
      React.useEffect(() => {
        onReadyChange(true);
      }, [onReadyChange]);
      return <div>配置编辑器</div>;
    }),
  };
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addListener() {}, removeListener() {} }),
  });
  sessionStorage.clear();
  jest.clearAllMocks();
  storeTemplateDraft('testTemplate', '测试模板');
  (api.components as jest.Mock).mockResolvedValue([
    {
      componentName: 'input',
      version: '1',
      manifest: {
        schemaComponent: 'Input',
        displayName: '输入框',
        defaultFieldSchema: { type: 'string', 'x-component': 'Input' },
      },
    },
    {
      componentName: 'card',
      version: '1',
      manifest: { schemaComponent: 'Card', displayName: '非活跃卡片' },
    },
  ]);
  (api.activeComponents as jest.Mock).mockResolvedValue([
    { componentName: 'input', version: '1' },
  ]);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const click = async (label: string) => {
  await act(async () => {
    Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent === label)!
      .click();
  });
};

test('three steps keep changes local, filter active components, and save the complete bundle only at completion', async () => {
  await act(async () => root.render(<LowCodeTemplateWizardPage />));
  expect(host.textContent).toContain('模板信息');
  await click('下一步');
  expect(host.textContent).toContain('输入框');
  expect(host.textContent).not.toContain('非活跃卡片');
  expect(api.create).not.toHaveBeenCalled();
  await act(async () => {
    host.querySelector<HTMLElement>('.template-component-row')!.click();
  });
  expect(host.textContent).toContain('组件信息');
  expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
  expect(
    Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent === '配置组件')!.disabled,
  ).toBe(true);
  await act(async () =>
    host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(),
  );
  expect(host.textContent).toContain('配置组件');
  await click('下一步');
  expect(host.querySelector('[data-testid="builder"]')!.textContent).toBe(
    '输入框',
  );
  expect(api.create).not.toHaveBeenCalled();
  (api.create as jest.Mock).mockImplementation(async (_kind, payload) => ({
    ...payload,
    id: 'template:testTemplate',
    kind: 'template',
    revision: 1,
  }));
  await click('完成并保存模板');
  expect(api.create).toHaveBeenCalledWith(
    'templates',
    expect.objectContaining({
      id: 'testTemplate',
      title: '测试模板',
      componentLocks: {
        Input: expect.objectContaining({
          remoteName: 'input',
          version: '1',
          defaultFieldSchema: { type: 'string', 'x-component': 'Input' },
          configSchema: { type: 'object', properties: {} },
          configBindings: {},
        }),
      },
    }),
  );
  expect(host.textContent).toContain('模板已保存');
  expect(
    sessionStorage.getItem('lowcode:template-draft:testTemplate'),
  ).toBeNull();
});

test('component config applies fields without bindings and hides steps only while editing', async () => {
  await act(async () => root.render(<LowCodeTemplateWizardPage />));
  await click('下一步');
  await act(async () => {
    host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  });
  await click('配置组件');
  expect(host.querySelector('.ant-steps')).toBeNull();
  expect(host.textContent).not.toContain('读取设计字段');
  expect(host.querySelector('.ant-select')).toBeNull();

  await click('应用配置并返回');
  expect(host.querySelector('.ant-steps')).not.toBeNull();
  expect(host.textContent).not.toContain('配置编辑器');
  expect(host.querySelector('.ant-alert-error')).toBeNull();
  expect(host.querySelector('.template-detail-meta strong')!.textContent).toBe('1');

  await click('下一步');
  (api.create as jest.Mock).mockImplementation(async (_kind, payload) => ({
    ...payload,
    revision: 1,
  }));
  await click('完成并保存模板');
  expect(api.create).toHaveBeenCalledWith(
    'templates',
    expect.objectContaining({
      componentLocks: {
        Input: expect.objectContaining({
          configSchema: mockConfigSchema,
          configBindings: {},
        }),
      },
    }),
  );
});
