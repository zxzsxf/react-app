import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import LowCodeFormBuilderPage from './LowCodeFormBuilderPage';
import { Document } from '../lowcode/api';

const act: typeof import('react-dom/test-utils').act = (React as any).act;
jest.mock('react-router-dom', () => ({ useParams: () => ({}) }), { virtual: true });
jest.mock('../lowcode/api', () => ({ api: {} }));
jest.mock('remote-component-loader', () => ({
  ReactRemoteComponent: ({ componentProps }: any) => (
    <section data-placeholder={componentProps.placeholder}>
      {componentProps.children || '组件内容'}
    </section>
  ),
}));

test('phone drag events reorder components, move into custom containers and back out, and disable in preview', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addListener() {}, removeListener() {} }),
  });
  const initial: Document = {
    id: 'template:drag',
    kind: 'template',
    title: '拖拽测试',
    revision: 0,
    bindings: {},
    componentLocks: {
      Input: {
        remoteName: 'input',
        version: '1',
        configVersion: 0,
        configSchema: {
          type: 'object',
          properties: {
            placeholder: { type: 'string', 'x-component': 'Input' },
          },
        },
      },
      Content: { remoteName: 'content', version: '1', configVersion: 0, kind: 'container', configSchema: { type: 'object' } },
    },
    schema: {
      type: 'object',
      properties: {
        first: { type: 'string', 'x-component': 'Input', 'x-index': 0 },
        box: { type: 'void', 'x-component': 'Content', 'x-index': 1 },
        last: { type: 'string', 'x-component': 'Input', 'x-index': 2 },
      },
    },
  };
  let latest = initial;
  const Wrapper = () => {
    const [document, setDocument] = useState(initial);
    return (
      <LowCodeFormBuilderPage
        template={{
          document,
          catalog: [],
          onChange: (next) => {
            latest = next;
            setDocument(next);
          },
        }}
      />
    );
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const node = (path: string) => host.querySelector<HTMLElement>(`[data-lowcode-path="${path}"]`)!;
  const transfer = {
    setData: jest.fn(),
    getData: jest.fn(() => ''),
    effectAllowed: '',
    dropEffect: '',
  };
  const drag = async (source: string, target: HTMLElement, clientY: number) => {
    const eventData = { dataTransfer: transfer, clientY } as any;
    await act(async () => Simulate.dragStart(node(source), eventData));
    await act(async () => Simulate.dragOver(target, eventData));
    await act(async () => Simulate.drop(target, eventData));
  };
  try {
    await act(async () => root.render(<Wrapper />));
    expect(node('first').draggable).toBe(true);
    await act(async () => Simulate.click(node('first')));
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('.lowcode-config input')!;
      input.value = '手机实时提示';
      Simulate.change(input);
    });
    expect(node('first').querySelector('section')!.dataset.placeholder).toBe('手机实时提示');
    await drag('first', node('last'), 0);
    expect(Object.keys(latest.schema.properties!)).toEqual(['box', 'last', 'first']);
    expect(Array.from(host.querySelectorAll('[data-lowcode-path]')).map((element) => element.getAttribute('data-lowcode-path'))).toEqual(['box', 'last', 'first']);
    await drag('first', node('box'), 0);
    expect(latest.schema.properties!.first).toBeUndefined();
    expect(latest.schema.properties!.box.properties!.first['x-component']).toBe('Input');
    expect(node('box.first').classList.contains('is-selected')).toBe(true);
    await drag('box.first', host.querySelector('.lowcode-phone-screen')!, 0);
    expect(latest.schema.properties!.first).toBeDefined();
    expect(node('first').classList.contains('is-selected')).toBe(true);
    expect(node('first').querySelector('section')!.dataset.placeholder).toBe('手机实时提示');
    expect(host.querySelector<HTMLInputElement>('.lowcode-config input')!.value).toBe('手机实时提示');
    await act(async () => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('预览'))!.click());
    expect(host.querySelector('[data-lowcode-path]')).toBeNull();
    expect(host.querySelector('[draggable="true"]')).toBeNull();
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
