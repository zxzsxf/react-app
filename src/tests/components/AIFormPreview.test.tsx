import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { FormPreview } from '../../pages/AIChatPage/components/FormPreview';
import { AIFormDraft } from '../../ai-chat/types';

const act: typeof import('react-dom/test-utils').act = (React as any).act;
let mockFail = false;

jest.mock('remote-component-loader', () => ({
  ReactRemoteComponent: ({ componentProps }: any) => {
    if (mockFail) {
      throw new Error('远程组件渲染异常');
    }
    return <input aria-label="远程姓名" value={componentProps.value || ''} onChange={(event) => componentProps.onChange(event.target.value)} />;
  },
}));

const draft: AIFormDraft = {
  title: '测试表单',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string', title: '姓名', required: true, 'x-component': 'Input', 'x-decorator': 'FormItem' },
    },
  },
  componentLocks: { Input: { remoteName: 'Input', version: '1.0.0', configVersion: 1 } },
};
let host: HTMLDivElement;
let root: Root;
const mount = (value: AIFormDraft, version: number) => root.render(
  <FormPreview
    draft={value}
    version={version}
    locked={false}
    generating={false}
    saving={false}
    canSave
    retrySave={false}
    onTitleChange={() => {}}
    onSave={() => {}}
  />,
);
const button = (text: string) => Array.from(host.querySelectorAll('button')).find((element) => element.textContent?.includes(text))!;

beforeEach(() => {
  mockFail = false;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addListener() {}, removeListener() {} }),
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.restoreAllMocks();
});

test('real Formily preview retains values on a title update and resets them for a new candidate', async () => {
  await act(async () => mount(draft, 1));
  const field = host.querySelector('input[aria-label="远程姓名"]')!;
  act(() => Simulate.change(field, { target: { value: '张三' } } as any));
  await act(async () => mount({ ...draft, title: '新标题' }, 1));
  expect((host.querySelector('input[aria-label="远程姓名"]') as HTMLInputElement).value).toBe('张三');
  await act(async () => { button('校验并查看表单值').click(); });
  expect(host.textContent).toContain('校验通过：{"name":"张三"}');
  await act(async () => mount(draft, 2));
  expect((host.querySelector('input[aria-label="远程姓名"]') as HTMLInputElement).value).toBe('');
  expect(host.textContent).not.toContain('校验通过');
});

test('manual preview reset clears entered values without changing the schema', async () => {
  await act(async () => mount(draft, 1));
  act(() => Simulate.change(host.querySelector('input[aria-label="远程姓名"]')!, { target: { value: '张三' } } as any));
  await act(async () => { button('重置填写值').click(); });
  expect((host.querySelector('input[aria-label="远程姓名"]') as HTMLInputElement).value).toBe('');
  expect(draft.schema.properties!.name.required).toBe(true);
});

test('render failures stay inside the preview boundary and retry remounts the remote component', async () => {
  mockFail = true;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => mount(draft, 1));
  expect(host.textContent).toContain('表单组件加载或渲染失败');
  mockFail = false;
  await act(async () => { button('重试预览').click(); });
  expect(host.querySelector('input[aria-label="远程姓名"]')).not.toBeNull();
  expect(host.textContent).not.toContain('表单组件加载或渲染失败');
});
