import { ReadableStream } from 'stream/web';
import { TextDecoder, TextEncoder } from 'util';
import { readGenerationStream } from '../../ai-chat/stream';
import { createRemoteGenerator } from '../../ai-chat/remote-generator';
import { aiApi, AISession } from '../../ai-chat/api';
import { GenerationEvent } from '../../ai-chat/types';

const originalFetch = globalThis.fetch;
const originalCrypto = globalThis.crypto;
const encoder = new TextEncoder();
const session: AISession = {
  id: 'session-1', title: '登记表', source: { mode: 'blank', templateId: '' },
  revision: 0, activeRunId: null,
  draft: { title: '登记表', schema: { type: 'object', properties: {} }, componentLocks: {} },
};

const response = (text: string, chunkBytes = 7) => {
  const bytes = encoder.encode(text);
  return {
    ok: true,
    headers: { get: () => 'text/event-stream' },
    body: new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += chunkBytes) {
          controller.enqueue(bytes.slice(i, i + chunkBytes));
        }
        controller.close();
      },
    }),
  } as unknown as Response;
};

const wire = (events: Record<string, unknown>[]) => events.map(event =>
  `event: ${event.type}\r\ndata: ${JSON.stringify({ runId: 'run-1', ...event })}\r\n\r\n`,
).join('');

beforeEach(() => {
  (globalThis as any).TextDecoder = TextDecoder;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => 'request-1' } });
});

afterEach(() => {
  jest.restoreAllMocks();
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
});

test('handles CRLF and UTF-8 split inside Chinese characters and delimiters', async () => {
  const events: GenerationEvent[] = [];
  const input = wire([
    { type: 'text_delta', text: '手机号登记表' },
    { type: 'done', revision: 1 },
  ]);
  for await (const event of readGenerationStream(response(input, 1), new AbortController().signal)) {
    events.push(event);
  }
  expect(events).toEqual([
    { type: 'text_delta', text: '手机号登记表', runId: 'run-1' },
    { type: 'done', revision: 1, runId: 'run-1' },
  ]);
});

test('rejects malformed events and streams without a terminal event', async () => {
  const consume = async (text: string) => {
    for await (const _event of readGenerationStream(response(text), new AbortController().signal)) {
      // 消费整个流，以验证终止规则。
    }
  };
  await expect(consume('event: text_delta\ndata: {broken}\n\n')).rejects.toThrow('无效数据');
  await expect(consume(wire([{ type: 'text_delta', text: '未结束' }]))).rejects.toThrow('中断');
});

test('recovers a committed result when done is lost without submitting a second request', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(response(wire([
    { type: 'accepted', assistantMessageId: 'assistant-1', userMessageId: 'user-1' },
    { type: 'text_delta', text: '部分回复' },
  ])));
  const draft = { ...session.draft, title: '完成的登记表' };
  jest.spyOn(aiApi, 'run').mockResolvedValue({
    id: 'run-1', sessionId: session.id, status: 'completed', prompt: '生成',
    assistantMessageId: 'assistant-1', userMessageId: 'user-1', reply: '完整回复',
    error: null, resultDraft: draft, resultRevision: 1,
  });
  const update = jest.fn();
  const { generator } = createRemoteGenerator(() => session, update);
  const result = [];
  for await (const event of generator({ message: '生成', currentDraft: session.draft }, new AbortController().signal)) {
    result.push(event);
  }
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(result).toContainEqual({ type: 'replace_text', text: '完整回复', runId: 'run-1' });
  expect(result[result.length - 1]).toEqual({ type: 'done', revision: 1, runId: 'run-1' });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ revision: 1, draft }));
});

test('synchronizes an edited title before sending its authoritative base revision', async () => {
  const changed = { ...session, draft: { ...session.draft, title: '手动标题' }, revision: 1 };
  const patch = jest.spyOn(aiApi, 'title').mockResolvedValue(changed);
  let current = session;
  globalThis.fetch = jest.fn().mockResolvedValue(response(wire([
    { type: 'accepted', assistantMessageId: 'assistant-1', userMessageId: 'user-1' },
    { type: 'draft', draft: changed.draft },
    { type: 'done', revision: 2 },
  ])));
  const { generator } = createRemoteGenerator(() => current, value => { current = value; });
  for await (const _event of generator({ message: '生成', currentDraft: changed.draft }, new AbortController().signal)) {
    // 读取到完成。
  }
  expect(patch).toHaveBeenCalledWith(session.id, '手动标题', 0);
  expect(JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body).baseRevision).toBe(1);
  expect(current.revision).toBe(2);
});
