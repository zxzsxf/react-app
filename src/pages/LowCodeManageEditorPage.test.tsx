import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import LowCodeManageEditorPage from './LowCodeManageEditorPage';
import { api, Document, SchemaNode } from '../lowcode/api';
import { storeTemplateDraft } from '../lowcode/template-draft';

const act: typeof import('react-dom/test-utils').act = (React as any).act;
let mockSchema: SchemaNode;
let mockId = 't1';
let mockSaveShortcut: () => void;

jest.mock('react-router-dom', () => ({ useParams: () => ({ id: mockId }) }), { virtual: true });
jest.mock('../lowcode/api', () => ({
  api: {
    get: jest.fn(),
    create: jest.fn(),
    components: jest.fn(),
    published: jest.fn(),
    save: jest.fn(),
    publish: jest.fn(),
  },
}));
jest.mock('../lowcode/FlowformManageEditor', () => {
  const React = require('react');
  return {
    FlowformManageEditor: React.forwardRef((props: any, ref: any) => {
      mockSaveShortcut = props.onSave;
      React.useImperativeHandle(ref, () => ({ readSchema: async () => mockSchema }));
      React.useEffect(() => props.onReadyChange(true), [props.onReadyChange]);
      return <div data-testid="remote-editor" />;
    }),
  };
});

let host: HTMLDivElement;
let root: Root;
let doc: Document;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addListener() {}, removeListener() {} }),
  });
  jest.clearAllMocks();
  sessionStorage.clear();
  mockId = 't1';
  mockSchema = { type: 'object', properties: {} };
  doc = {
    id: 'template:t1',
    kind: 'template',
    title: '测试模板',
    schema: mockSchema,
    revision: 3,
    bindings: {},
    componentLocks: {},
  };
  (api.get as jest.Mock).mockImplementation(async () => doc);
  (api.components as jest.Mock).mockResolvedValue([]);
  (api.save as jest.Mock).mockImplementation(async (_kind, _id, payload) => ({
    ...doc,
    ...payload,
    revision: payload.revision + 1,
  }));
  (api.publish as jest.Mock).mockResolvedValue({ version: 2 });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const mount = async (kind: 'templates' | 'component-configs') => {
  await act(async () => root.render(<LowCodeManageEditorPage kind={kind} />));
};
const click = async (label: string) => {
  const button = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent?.replace(/\s/g, '') === label,
  )!;
  await act(async () => button.click());
};

test('template save preserves locks, removes unused locks and cleans schema', async () => {
  doc.componentLocks = {
    Card: { remoteName: 'card', version: '1.0.0', configVersion: 1 },
    Unused: { remoteName: 'unused', version: '1.0.0', configVersion: 1 },
  };
  (api.components as jest.Mock).mockResolvedValue([
    { componentName: 'input', version: '1.2.0', manifest: { schemaComponent: 'Input' } },
  ]);
  (api.published as jest.Mock).mockResolvedValue({ version: 7 });
  mockSchema = {
    type: 'object',
    properties: {
      card: {
        type: 'void',
        'x-component': 'Card',
        properties: {
          name: {
            type: 'string',
            'x-component': 'Input',
            required: true,
            'x-component-props': { placeholder: '姓名', unsupported: true },
          },
        },
      },
    },
  };
  await mount('templates');
  const frame = host.querySelector('[data-testid="remote-editor"]');
  await click('保存');
  expect(api.save).toHaveBeenCalledWith(
    'templates',
    't1',
    expect.objectContaining({
      revision: 3,
      componentLocks: {
        Card: doc.componentLocks.Card,
        Input: { remoteName: 'input', version: '1.2.0', configVersion: 7 },
      },
      schema: {
        type: 'object',
        properties: {
          card: {
            type: 'void',
            'x-component': 'Card',
            properties: {
              name: {
                type: 'string',
                'x-component': 'Input',
                required: true,
                'x-component-props': { placeholder: '姓名' },
              },
            },
          },
        },
      },
    }),
  );
  expect(api.publish).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('模板设计');
  expect(host.textContent).not.toContain('保存草稿');
  expect(host.textContent).not.toContain('发布');
  expect(host.querySelector('input')).toBeNull();
  expect(host.querySelector('[data-testid="remote-editor"]')).toBe(frame);
  await click('保存');
  expect(api.save).toHaveBeenLastCalledWith(
    'templates',
    't1',
    expect.objectContaining({ revision: 4 }),
  );
});

test('configuration save prunes deleted bindings and retains Input/Switch schema', async () => {
  mockId = 'input:1.0.0';
  doc.kind = 'config';
  doc.bindings = { label: 'title', disabled: 'x-component-props.disabled', removed: 'required' };
  mockSchema = {
    type: 'object',
    properties: {
      label: { type: 'string', 'x-component': 'Input' },
      disabled: { type: 'boolean', 'x-component': 'Switch' },
    },
  };
  await mount('component-configs');
  await click('读取设计字段');
  expect(host.textContent).not.toContain('removed');
  await click('保存草稿');
  expect(api.save).toHaveBeenCalledWith(
    'component-configs',
    'input:1.0.0',
    expect.objectContaining({
      schema: mockSchema,
      bindings: { label: 'title', disabled: 'x-component-props.disabled' },
    }),
  );
  expect(api.publish).not.toHaveBeenCalled();
});

test('unbound new fields block saving and become available for binding', async () => {
  mockId = 'card:1.0.0';
  doc.kind = 'config';
  mockSchema = {
    type: 'object',
    properties: { added: { type: 'string', 'x-component': 'Input' } },
  };
  await mount('component-configs');
  await click('发布');
  expect(host.textContent).toContain('请先为字段 added 选择目标属性');
  expect(api.save).not.toHaveBeenCalled();
  expect(api.publish).not.toHaveBeenCalled();
  expect(host.textContent).toContain('added');
});

test('shortcut and button cannot duplicate an active save; revision errors are displayed', async () => {
  let rejectSave!: (error: Error) => void;
  (api.save as jest.Mock).mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectSave = reject;
      }),
  );
  await mount('templates');
  await act(async () => {
    mockSaveShortcut();
    mockSaveShortcut();
  });
  expect(api.save).toHaveBeenCalledTimes(1);
  await click('保存');
  expect(api.save).toHaveBeenCalledTimes(1);
  await act(async () => rejectSave(new Error('Document changed; reload before saving')));
  expect(host.textContent).toContain('Document changed; reload before saving');
  expect(api.publish).not.toHaveBeenCalled();
});

test('a failed publish keeps the saved revision for the next attempt', async () => {
  (api.publish as jest.Mock).mockRejectedValueOnce(new Error('发布失败'));
  await mount('component-configs');
  await click('发布');
  expect(host.textContent).toContain('发布失败');
  await click('发布');
  expect(api.save).toHaveBeenLastCalledWith(
    'component-configs',
    't1',
    expect.objectContaining({ revision: 4 }),
  );
  expect(api.publish).toHaveBeenLastCalledWith('component-configs', 't1', 5);
});

test('a new template is created only on save and subsequent saves update its revision', async () => {
  storeTemplateDraft('t1', '新建模板');
  (api.create as jest.Mock).mockImplementation(async (_kind, payload) => ({
    ...doc,
    ...payload,
    id: 'template:t1',
    revision: 1,
  }));
  await mount('templates');
  expect(api.get).not.toHaveBeenCalled();
  expect(api.create).not.toHaveBeenCalled();
  mockSchema = {
    type: 'object',
    properties: { name: { type: 'string', title: '姓名' } },
  };
  await click('保存');
  expect(api.create).toHaveBeenCalledWith('templates', {
    id: 't1',
    title: '新建模板',
    schema: mockSchema,
    componentLocks: {},
    bindings: {},
  });
  expect(api.save).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
  await act(async () => mockSaveShortcut());
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.save).toHaveBeenCalledWith('templates', 't1', expect.objectContaining({ revision: 1 }));
});

test('a failed template creation retains the draft and can be retried', async () => {
  storeTemplateDraft('t1', '新建模板');
  (api.create as jest.Mock)
    .mockRejectedValueOnce(new Error('创建失败'))
    .mockResolvedValueOnce({ ...doc, revision: 1 });
  await mount('templates');
  await click('保存');
  expect(host.textContent).toContain('创建失败');
  expect(sessionStorage.length).toBe(1);
  await click('保存');
  expect(api.create).toHaveBeenCalledTimes(2);
  expect(api.save).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});
