import { createParser } from 'eventsource-parser';
import { AIError } from './api';
import { GenerationEvent } from './types';

const allowedEvents = new Set(['accepted', 'status', 'text_delta', 'draft', 'done', 'error']);

export async function* readGenerationStream(response: Response, signal: AbortSignal): AsyncGenerator<GenerationEvent> {
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new AIError(result.message || `生成请求失败 (${response.status})`, response.status, result.runId);
  }
  if (!response.headers.get('Content-Type')?.includes('text/event-stream') || !response.body) {
    throw new Error('AI 服务没有返回有效的事件流');
  }
  const events: GenerationEvent[] = [];
  let parseError: Error | null = null;
  const parser = createParser({
    maxBufferSize: 512 * 1024,
    onEvent: event => {
      try {
        const parsed = JSON.parse(event.data);
        if (!allowedEvents.has(parsed.type) || parsed.type !== event.event || typeof parsed.runId !== 'string') {
          throw new Error('事件类型或任务 ID 无效');
        }
        events.push(parsed as GenerationEvent);
      } catch {
        parseError = new Error('AI 事件流包含无效数据');
      }
    },
    onError: () => { parseError = new Error('AI 事件流解析失败'); },
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      if (signal.aborted) {
        throw new DOMException('已中断', 'AbortError');
      }
      const { value, done } = await reader.read();
      parser.feed(done ? decoder.decode() : decoder.decode(value, { stream: true }));
      if (parseError) {
        throw parseError;
      }
      while (events.length) {
        const event = events.shift()!;
        yield event;
        if (event.type === 'done' || event.type === 'error') {
          return;
        }
      }
      if (done) {
        throw new Error('生成连接意外中断，请核对任务状态');
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
