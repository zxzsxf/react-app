import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useAIChat } from '../../ai-chat/useAIChat';
import { AIFormDraft, GenerationEvent, Generator } from '../../ai-chat/types';

const act: typeof import('react-dom/test-utils').act = (React as any).act;
const initial: AIFormDraft = {
  title: '原表单',
  schema: { type: 'object', properties: {} },
  componentLocks: {},
};
let host: HTMLDivElement;
let root: Root;
let state: ReturnType<typeof useAIChat>;
const mount = (element: React.ReactNode) => root.render(element);

const Harness: React.FC<{ generator: Generator }> = ({ generator }) => {
  state = useAIChat(generator);
  return <div>{state.draft?.title}</div>;
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

test('stopping ignores a late candidate even when a provider ignores the abort signal', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const generator: Generator = async function* () {
    yield { type: 'text_delta', text: '正在处理' };
    await gate;
    yield { type: 'draft', draft: { ...initial, title: '迟到的表单' } };
    yield { type: 'done' };
  };
  await act(async () => mount(<Harness generator={generator} />));
  act(() => state.reset(initial));
  await act(async () => { state.send('生成'); });
  expect(state.status).toBe('generating');
  act(() => state.stop());
  await act(async () => { release(); });
  expect(state.draft?.title).toBe('原表单');
  expect(state.version).toBe(0);
  expect(state.messages[1].status).toBe('stopped');
  expect(state.status).toBe('idle');
});

test('resetting cancels the old run and only the current assistant message is pending', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const generator: Generator = async function* () {
    calls++;
    if (calls === 2) {
      await gate;
    }
    yield { type: 'text_delta', text: '完成' };
    yield { type: 'done' };
  };
  await act(async () => mount(<Harness generator={generator} />));
  act(() => state.reset(initial));
  await act(async () => { state.send('第一轮'); });
  await act(async () => { state.send('第二轮'); });
  expect(state.messages.map((item) => item.status)).toEqual(['complete', 'complete', 'complete', 'generating']);
  act(() => state.reset({ ...initial, title: '新会话' }));
  await act(async () => { release(); });
  expect(state.draft?.title).toBe('新会话');
  expect(state.messages).toEqual([]);
});

test('a staged candidate is applied only after done; a broken stream preserves the previous version', async () => {
  const events: GenerationEvent[] = [{ type: 'draft', draft: { ...initial, title: '未完成' } }];
  const generator: Generator = async function* () {
    for (const event of events) {
      yield event;
    }
  };
  await act(async () => mount(<Harness generator={generator} />));
  act(() => state.reset(initial));
  await act(async () => { state.send('第一轮'); });
  expect(state.status).toBe('error');
  expect(state.draft?.title).toBe('原表单');
  events.push({ type: 'done' });
  await act(async () => { state.retry(); });
  expect(state.draft?.title).toBe('未完成');
  expect(state.version).toBe(1);
});

test('rapid duplicate sends are blocked before React rerenders', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const generator: Generator = async function* () {
    await gate;
    yield { type: 'done' };
  };
  await act(async () => mount(<Harness generator={generator} />));
  act(() => state.reset(initial));
  act(() => {
    expect(state.send('第一条')).toBe(true);
    expect(state.send('重复')).toBe(false);
  });
  await act(async () => { release(); });
  expect(state.messages).toHaveLength(2);
});

test('accepted server IDs receive streamed text and the server revision', async () => {
  const generator: Generator = async function* () {
    yield { type: 'accepted', runId: 'run-1', userMessageId: 'user-server', assistantMessageId: 'assistant-server' };
    yield { type: 'text_delta', runId: 'run-1', text: '服务器回复' };
    yield { type: 'draft', draft: { ...initial, title: '服务器候选' } };
    yield { type: 'done', runId: 'run-1', revision: 8 };
  };
  await act(async () => mount(<Harness generator={generator} />));
  act(() => state.reset(initial));
  await act(async () => { state.send('生成'); });
  expect(state.messages[1]).toMatchObject({ id: 'assistant-server', content: '服务器回复', status: 'complete', runId: 'run-1' });
  expect(state.version).toBe(8);
});

test('hydrated interrupted messages resume without adding another user message', async () => {
  const generator: Generator = async function* (input) {
    expect(input.resumeRunId).toBe('run-1');
    yield { type: 'accepted', runId: 'run-1', userMessageId: 'user-server', assistantMessageId: 'assistant-server' };
    yield { type: 'text_delta', text: '恢复完成' };
    yield { type: 'draft', draft: { ...initial, title: '新候选' } };
    yield { type: 'done', revision: 4 };
  };
  await act(async () => mount(<Harness generator={generator} />));
  act(() => state.reset(initial, [
    { id: 'user-server', role: 'user', content: '生成', status: 'complete', runId: 'run-1' },
    { id: 'assistant-server', role: 'assistant', content: '部分内容', status: 'interrupted', runId: 'run-1' },
  ], 3));
  await act(async () => { state.resume('run-1', '生成'); });
  expect(state.messages).toHaveLength(2);
  expect(state.messages[1].content).toBe('恢复完成');
  expect(state.version).toBe(4);
});

test('a stop racing with an already committed run reconciles the authoritative result', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const generator: Generator = async function* () {
    yield { type: 'accepted', runId: 'run-1', userMessageId: 'u1', assistantMessageId: 'a1' };
    await gate;
    yield { type: 'done' };
  };
  generator.cancel = async () => ({
    draft: { ...initial, title: '已经提交的候选' }, revision: 7, reply: '已完成',
    runId: 'run-1', assistantMessageId: 'a1', userMessageId: 'u1',
  });
  await act(async () => mount(<Harness generator={generator} />));
  act(() => state.reset(initial));
  await act(async () => { state.send('生成'); });
  await act(async () => { state.stop(); });
  expect(state.draft?.title).toBe('已经提交的候选');
  expect(state.messages[1].status).toBe('complete');
  expect(state.version).toBe(7);
  await act(async () => { release(); });
  expect(state.draft?.title).toBe('已经提交的候选');
});
