import React from 'react';
import { Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { LowCodeRenderer, MobileFormHandle } from './MobileRenderer';
const act: typeof import('react-dom/test-utils').act = (React as any).act;

jest.mock('remote-component-loader', () => ({
  ReactRemoteComponent: ({ name, componentProps }: any) => {
    const ReactModule = require('react');
    return name === 'Input'
      ? ReactModule.createElement('input', { value: componentProps.value || '', onChange: (event: any) => componentProps.onChange(event.target.value) })
      : ReactModule.createElement('section', null, componentProps.children);
  },
}));

test('remote Input in a void Card writes a Formily value', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const ref = React.createRef<MobileFormHandle>();
  act(() => root.render(<LowCodeRenderer formRef={ref} schema={{ type: 'object', properties: { card: { type: 'void', 'x-component': 'Card', properties: { name: { type: 'string', title: '姓名', required: true, 'x-decorator': 'FormItem', 'x-component': 'Input' } } } } }} locks={{ Input: { remoteName: 'Input', version: '0.0.2', configVersion: 1 }, Card: { remoteName: 'card', version: '0.0.2', configVersion: 1 } }} />));
  const input = host.querySelector('input') as HTMLInputElement;
  expect(input).not.toBeNull();
  act(() => Simulate.change(input, { target: { value: '张三' } as any }));
  expect(ref.current?.getValues()).toEqual({ name: '张三' });
  act(() => root.unmount());
  host.remove();
});

test('nested editor containers select and delete their own paths and disappear in preview', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onSelect = jest.fn();
  const onRemove = jest.fn();
  const schema = {
    type: 'object',
    properties: {
      card: {
        type: 'void',
        'x-component': 'Card',
        properties: {
          name: {
            type: 'string',
            title: '姓名',
            'x-component': 'Input',
            'x-decorator': 'FormItem',
          },
        },
      },
    },
  };
  const locks = {
    Input: { remoteName: 'Input', version: '1', configVersion: 1 },
    Card: { remoteName: 'card', version: '1', configVersion: 1 },
  };
  try {
    act(() => root.render(
      <LowCodeRenderer
        schema={schema}
        locks={locks}
        onSelect={onSelect}
        onRemove={onRemove}
        selectedPath="card.name"
      />,
    ));
    const nested = host.querySelector('[data-lowcode-path="card.name"]')!;
    expect(nested.classList.contains('is-selected')).toBe(true);
    expect(host.querySelectorAll('.lowcode-editor-node-remove')).toHaveLength(1);
    expect(host.querySelector('[data-lowcode-path="card"] > button')).toBeNull();
    const label = nested.querySelector('label')!;
    expect(label.textContent).toBe('姓名');
    expect(nested.querySelector('input')).not.toBeNull();
    act(() => Simulate.click(label));
    expect(onSelect.mock.calls).toEqual([['card.name']]);
    act(() => Simulate.click(nested.querySelector('button')!));
    expect(onRemove).toHaveBeenCalledWith('card.name');
    expect(onSelect).toHaveBeenCalledTimes(1);
    act(() => root.render(
      <LowCodeRenderer
        schema={schema}
        locks={locks}
        onSelect={onSelect}
        onRemove={onRemove}
        selectedPath="card"
      />,
    ));
    expect(host.querySelectorAll('.lowcode-editor-node-remove')).toHaveLength(1);
    expect(nested.querySelector('button')).toBeNull();
    act(() => Simulate.click(host.querySelector('[data-lowcode-path="card"] > button')!));
    expect(onRemove).toHaveBeenLastCalledWith('card');

    act(() => root.render(
      <LowCodeRenderer schema={schema} locks={locks} onSelect={onSelect} onRemove={onRemove} />,
    ));
    expect(host.querySelector('.lowcode-editor-node-remove')).toBeNull();

    act(() => root.render(<LowCodeRenderer schema={schema} locks={locks} />));
    expect(host.querySelector('.lowcode-editor-node')).toBeNull();
    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('input')).not.toBeNull();
    expect(host.querySelector('label')?.textContent).toBe('姓名');
    expect(schema.properties.card.properties.name['x-decorator']).toBe('FormItem');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
