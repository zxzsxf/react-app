import React from 'react';
import { createRoot } from 'react-dom/client';
import { DesignerShell } from '../../lowcode/DesignerShell';
import { createFormDesigner, loadFormSchema, readFormSchema } from 'flowform-designable-bridge';
import { IconWidget } from '@designable/react';
const act: typeof import('react-dom/test-utils').act = (React as any).act;

test('Designable template editor mounts in React 18 with Input and Card', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (window as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (window as any).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<React.StrictMode><DesignerShell schema={{ type: 'object', properties: { name: { type: 'string', title: '姓名', 'x-component': 'Input' } } }} mode="template" onSave={() => {}} onPublish={() => {}} /></React.StrictMode>); });
  expect(host.textContent).toContain('保存草稿');
  act(() => root.unmount());
  host.remove();
});

test('Designable shadow icons reuse their root and update content and dimensions', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const ShadowSVG = IconWidget.ShadowSVG!;
  try {
    act(() => root.render(<React.StrictMode><ShadowSVG content='<path id="first" />' width={24} height="1em" /></React.StrictMode>));
    const shadow = host.firstElementChild!.shadowRoot!;
    expect(shadow.querySelector('#first')).not.toBeNull();
    expect(shadow.querySelector('svg')!.style.width).toBe('24px');
    expect(shadow.querySelector('svg')!.style.height).toBe('1em');
    act(() => root.render(<React.StrictMode><ShadowSVG content='<circle id="second" />' width="32" height={40} /></React.StrictMode>));
    expect(host.firstElementChild!.shadowRoot).toBe(shadow);
    expect(shadow.querySelector('#first')).toBeNull();
    expect(shadow.querySelector('#second')).not.toBeNull();
    expect(shadow.querySelector('svg')!.style.width).toBe('32px');
    expect(shadow.querySelector('svg')!.style.height).toBe('40px');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test('Designable preserves Card and Input fields through an editing tree', () => {
  const schema = { type: 'object', properties: { card: { type: 'void', title: '客户资料', 'x-component': 'Card', 'x-component-props': { title: '客户资料' }, properties: { name: { type: 'string', title: '姓名', required: true, 'x-component': 'Input', 'x-component-props': { placeholder: '请输入姓名' } } } } } };
  const engine = createFormDesigner('lowcode');
  loadFormSchema(engine, schema);
  const result = readFormSchema(engine) as any;
  expect(result.properties?.card?.['x-component']).toBe('Card');
  expect(result.properties?.card?.properties?.name).toMatchObject(schema.properties.card.properties.name);
});
