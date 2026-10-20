import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import LowCodeFormBuilderPage from './LowCodeFormBuilderPage';
import { Document } from '../lowcode/api';

const act: typeof import('react-dom/test-utils').act = (React as any).act;
jest.mock('react-router-dom', () => ({ useParams: () => ({}) }), {
  virtual: true,
});
jest.mock('../lowcode/MobileRenderer', () => ({
  LowCodeRenderer: () => <div>画布</div>,
}));
jest.mock('../lowcode/api', () => ({
  api: { published: jest.fn(), versioned: jest.fn() },
}));

test('embedded configuration renders and updates its bound property', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addListener() {}, removeListener() {} }),
  });
  const initial: Document = {
    id: 'template:test',
    kind: 'template',
    title: '测试',
    revision: 0,
    bindings: {},
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: '姓名',
          'x-component': 'Input',
          'x-component-props': { placeholder: '原提示' },
        },
      },
    },
    componentLocks: {
      Input: {
        remoteName: 'input',
        version: '1',
        configVersion: 0,
        configSchema: {
          type: 'object',
          properties: {
            hint: {
              type: 'string',
              title: '提示文案',
              'x-decorator': 'FormItem',
              'x-component': 'Input',
            },
          },
        },
        configBindings: { hint: 'x-component-props.placeholder' },
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
  try {
    await act(async () => root.render(<Wrapper />));
    await act(async () =>
      Array.from(host.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('name ·'))!
        .click(),
    );
    expect(host.textContent).toContain('提示文案');
    const input = host.querySelector('input')!;
    expect(input.value).toBe('原提示');
    await act(async () => {
      input.value = '新提示';
      Simulate.change(input);
    });
    expect(
      latest.schema.properties!.name['x-component-props']!.placeholder,
    ).toBe('新提示');
    expect(latest.schema.properties!.name.title).toBe('姓名');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
