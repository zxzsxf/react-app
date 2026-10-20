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
