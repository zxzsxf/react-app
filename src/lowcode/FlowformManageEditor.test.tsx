import React, { createRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { FlowformManageEditor, FlowformManageEditorHandle } from './FlowformManageEditor';
import { SchemaNode } from './api';
import { isManageMessage, MANAGE_CHANNEL, MANAGE_VERSION } from './manage-editor-protocol';

const act: typeof import('react-dom/test-utils').act = (React as any).act;

const schema: SchemaNode = {
  type: 'object',
  properties: { name: { type: 'string', 'x-component': 'Input' } },
};
let host: HTMLDivElement;
let root: Root;
let uuid = 0;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  process.env.REACT_APP_FLOWFORM_EDITOR_URL = 'http://localhost:6575/editor';
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: { randomUUID: () => `session-${++uuid}` },
  });
  jest.useFakeTimers();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.useRealTimers();
  delete process.env.REACT_APP_FLOWFORM_EDITOR_URL;
});

async function mountEditor() {
  const ref = createRef<FlowformManageEditorHandle>();
  const onReadyChange = jest.fn();
  const onSave = jest.fn();
  const render = (id = 't1', value = schema) => {
    root.render(
      <FlowformManageEditor
        ref={ref}
        id={id}
        kind="templates"
        schema={value}
        onReadyChange={onReadyChange}
        onSave={onSave}
      />,
    );
  };
  act(() => render());
  const frame = host.querySelector('iframe')!;
  const post = jest.spyOn(frame.contentWindow!, 'postMessage');
  await act(async () => frame.dispatchEvent(new Event('load')));
  const receive = async (
    type: string,
    extra = {},
    source: MessageEventSource | null = frame.contentWindow,
    origin = 'http://localhost:6575',
  ) => {
    const sent = post.mock.calls[post.mock.calls.length - 1][0] as any;
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source,
          origin,
          data: { ...sent, type, ...extra },
        }),
      );
    });
  };
  const initialize = async () => {
    await receive('ready');
    expect(post.mock.calls[post.mock.calls.length - 1][0]).toMatchObject({
      type: 'initialize',
      schema,
    });
    await receive('initialized');
  };
  return { ref, frame, post, receive, initialize, render, onReadyChange, onSave };
}

test('initializes once, reads current schema and preserves the frame after saving', async () => {
  const editor = await mountEditor();
  expect(new URL(editor.frame.src).searchParams.get('flowformMode')).toBe('manage');
  expect(editor.post).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'connect' }),
    'http://localhost:6575',
  );
  await editor.initialize();
  expect(editor.onReadyChange).toHaveBeenLastCalledWith(true);
  let result!: Promise<unknown>;
  act(() => {
    result = editor.ref.current!.readSchema();
  });
  await editor.receive('schema', { schema });
  await expect(result).resolves.toEqual(schema);
  const count = editor.post.mock.calls.length;
  act(() => editor.render('t1', { type: 'object', properties: {} }));
  expect(host.querySelector('iframe')).toBe(editor.frame);
  expect(editor.post).toHaveBeenCalledTimes(count);
  await editor.receive('save');
  expect(editor.onSave).toHaveBeenCalledTimes(1);
});

test('rejects messages from another source, origin, session or protocol version', async () => {
  const editor = await mountEditor();
  await editor.receive('ready', {}, window);
  await editor.receive('ready', {}, editor.frame.contentWindow, 'http://untrusted.example');
  await editor.receive('ready', { sessionId: 'other-session' });
  await editor.receive('ready', { version: 2 });
  expect(editor.post.mock.calls.every(([message]) => (message as any).type === 'connect')).toBe(
    true,
  );
  await editor.initialize();
  let result!: Promise<unknown>;
  act(() => {
    result = editor.ref.current!.readSchema();
  });
  await editor.receive('schema', { schema: { type: 'object', properties: { invalid: null } } });
  const rejection = expect(result).rejects.toThrow('通信超时');
  await act(async () => jest.advanceTimersByTime(15000));
  await rejection;
  expect(editor.onReadyChange).toHaveBeenLastCalledWith(false);
});

test('retries handshake, times out and creates a fresh session on retry', async () => {
  const editor = await mountEditor();
  await act(async () => jest.advanceTimersByTime(500));
  expect(editor.post).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(15000));
  expect(host.textContent).toContain('通信超时');
  const retry = Array.from(host.querySelectorAll('button')).find(
    (button) => button.textContent?.replace(/\s/g, '') === '重试',
  )!;
  act(() => retry.click());
  expect(host.querySelector('iframe')).not.toBe(editor.frame);
  expect(host.querySelector('iframe')!.src).not.toBe(editor.frame.src);
});

test('reload reinitializes from the latest saved schema and closes pending reads', async () => {
  const editor = await mountEditor();
  await editor.initialize();
  let result!: Promise<unknown>;
  act(() => {
    result = editor.ref.current!.readSchema();
  });
  const rejection = expect(result).rejects.toThrow('重新加载');
  const updated = { type: 'object', properties: {} };
  act(() => editor.render('t1', updated));
  await act(async () => editor.frame.dispatchEvent(new Event('load')));
  await rejection;
  await editor.receive('ready');
  expect(editor.post.mock.calls[editor.post.mock.calls.length - 1][0]).toMatchObject({
    type: 'initialize',
    schema: updated,
  });
  await editor.receive('initialized');
  expect(editor.onReadyChange).toHaveBeenLastCalledWith(true);
});

test('route identity change ignores the previous iframe and clears in-flight requests', async () => {
  const editor = await mountEditor();
  await editor.initialize();
  let result!: Promise<unknown>;
  act(() => {
    result = editor.ref.current!.readSchema();
  });
  const rejection = expect(result).rejects.toThrow('会话已关闭');
  await act(async () => editor.render('t2'));
  await rejection;
  expect(host.querySelector('iframe')).not.toBe(editor.frame);
  await editor.receive('save');
  expect(editor.onSave).not.toHaveBeenCalled();
});

test('wire validator rejects malformed envelopes and accepts nested Card schemas', () => {
  const envelope = {
    channel: MANAGE_CHANNEL,
    version: MANAGE_VERSION,
    sessionId: 'test',
    requestId: 'read',
    type: 'schema',
  };
  expect(
    isManageMessage({
      ...envelope,
      schema: {
        type: 'object',
        properties: { card: { type: 'void', properties: schema.properties } },
      },
    }),
  ).toBe(true);
  expect(isManageMessage({ ...envelope, requestId: '' })).toBe(false);
  expect(isManageMessage({ ...envelope, schema: [] })).toBe(false);
});

test('missing deployed editor URL shows a configuration error without creating an iframe', () => {
  delete process.env.REACT_APP_FLOWFORM_EDITOR_URL;
  act(() =>
    root.render(
      <FlowformManageEditor
        id="t1"
        kind="templates"
        schema={schema}
        onReadyChange={() => {}}
        onSave={() => {}}
      />,
    ),
  );
  expect(host.textContent).toContain('未配置线上表单编辑器地址');
  expect(host.querySelector('iframe')).toBeNull();
});
