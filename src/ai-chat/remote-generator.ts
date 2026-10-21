import { lowcodeHeaders } from '../lowcode/api';
import { aiApi, AIError, AISession } from './api';
import { validateDraft } from './draft';
import { AIFormDraft, Generator } from './types';
import { readGenerationStream } from './stream';

export function createRemoteGenerator(
  getSession: () => AISession | null,
  updateSession: (session: AISession) => void,
) {
  let activeRunId: string | null = null;
  let activeRequest: { sessionId: string; requestId: string } | null = null;

  const flushTitle = async (draft: AIFormDraft) => {
    const session = getSession();
    if (!session) {
      throw new Error('请先创建或选择会话');
    }
    if (!draft.title.trim()) {
      throw new Error('请填写表单名称');
    }
    if (draft.title.trim() !== session.draft.title) {
      const changed = await aiApi.title(session.id, draft.title.trim(), session.revision);
      updateSession({ ...session, ...changed });
      return changed;
    }
    return session;
  };

  const generator: Generator = async function* (input, signal) {
    activeRunId = input.resumeRunId || null;
    activeRequest = null;
    const session = input.resumeRunId ? getSession() : await flushTitle(input.currentDraft);
    if (!session || signal.aborted) {
      throw new Error('会话已切换或生成已停止');
    }
    const requestId = crypto.randomUUID();
    activeRequest = input.resumeRunId ? null : { sessionId: session.id, requestId };
    let candidate: AIFormDraft | null = null;
    let done = false;
    try {
      const path = input.resumeRunId ? `/runs/${input.resumeRunId}/resume` : `/sessions/${session.id}/messages/stream`;
      const response = await fetch(`/api/lowcode/ai${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        signal,
        headers: { 'Content-Type': 'application/json', ...lowcodeHeaders() },
        body: JSON.stringify(input.resumeRunId ? {} : {
          clientRequestId: requestId,
          baseRevision: session.revision,
          message: input.message,
        }),
      });
      for await (const event of readGenerationStream(response, signal)) {
        if (event.type === 'accepted') {
          activeRunId = event.runId;
        }
        if (event.runId && activeRunId && event.runId !== activeRunId) {
          throw new Error('收到其他任务的事件');
        }
        if (event.type === 'draft') {
          validateDraft(event.draft);
          candidate = event.draft;
        }
        if (event.type === 'error') {
          yield event;
          return;
        }
        if (event.type === 'done') {
          if (!candidate || typeof event.revision !== 'number') {
            throw new Error('生成完成事件缺少候选或版本');
          }
          updateSession({ ...session, draft: candidate, revision: event.revision, activeRunId: null });
          done = true;
        }
        yield event;
      }
    } catch (cause) {
      if (signal.aborted) {
        throw cause;
      }
      if (cause instanceof AIError && !cause.runId) {
        throw cause;
      }
      if (cause instanceof AIError && cause.runId) {
        activeRunId = cause.runId;
      }
      // 发送成功但 accepted/done 丢失时，通过幂等请求 ID 查询，绝不再次提交生成。
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        if (signal.aborted) {
          throw new DOMException('已中断', 'AbortError');
        }
        const result = activeRunId
          ? await aiApi.run(activeRunId)
          : await aiApi.request(session.id, requestId);
        activeRunId = result.id;
        if (result.status === 'completed' && result.resultDraft && result.resultRevision !== null) {
          validateDraft(result.resultDraft);
          updateSession({ ...session, draft: result.resultDraft, revision: result.resultRevision, activeRunId: null });
          yield { type: 'replace_text', text: result.reply, runId: result.id };
          yield { type: 'draft', draft: result.resultDraft, runId: result.id };
          yield { type: 'done', revision: result.resultRevision, runId: result.id };
          done = true;
          break;
        }
        if (result.status !== 'running') {
          yield { type: 'error', runId: result.id, status: result.status, message: result.error || '任务未完成' };
          return;
        }
      }
      if (!done) {
        throw cause;
      }
    }
  };

  generator.cancel = async () => {
    let id = activeRunId;
    for (let attempt = 0; !id && activeRequest && attempt < 3; attempt++) {
      try {
        id = (await aiApi.request(activeRequest.sessionId, activeRequest.requestId)).id;
      } catch (error) {
        if (!(error instanceof AIError) || error.status !== 404) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    if (id) {
      const result = await aiApi.cancel(id);
      if (result.status === 'completed' && result.resultDraft && result.resultRevision !== null) {
        const current = getSession();
        if (current?.id === result.sessionId) {
          updateSession({ ...current, draft: result.resultDraft, revision: result.resultRevision, activeRunId: null });
        }
        return {
          draft: result.resultDraft,
          revision: result.resultRevision,
          reply: result.reply,
          runId: result.id,
          assistantMessageId: result.assistantMessageId,
          userMessageId: result.userMessageId,
        };
      }
    } else if (activeRequest) {
      throw new Error('停止请求尚未确认');
    }
  };
  return { generator, flushTitle };
}
