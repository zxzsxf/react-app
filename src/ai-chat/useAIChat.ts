import { useCallback, useEffect, useRef, useState } from 'react';
import { generate } from './mock-generator';
import { AIFormDraft, ChatMessage, clone, Generator } from './types';

interface ActiveGeneration {
  controller: AbortController;
  id: string;
  userId: string;
  provider: Generator;
  runId?: string;
  interrupted?: boolean;
}

export const useAIChat = (generator: Generator = generate) => {
  const [draft, setDraft] = useState<AIFormDraft | null>(null);
  const [version, setVersion] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'generating' | 'error'>('idle');
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const draftRef = useRef(draft);
  const run = useRef<ActiveGeneration | null>(null);
  const lastMessage = useRef('');
  const sequence = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      run.current?.controller.abort();
      run.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    const active = run.current;
    if (!active) {
      return;
    }
    run.current = null;
    const stoppedSequence = sequence.current;
    void active.provider.cancel?.().then(result => {
      if (result && mounted.current && sequence.current === stoppedSequence) {
        const next = clone(result.draft);
        draftRef.current = next;
        setDraft(next);
        setVersion(result.revision);
        setMessages(current => current.map(item => item.id === active.id
          ? { ...item, id: result.assistantMessageId, content: result.reply, status: 'complete', runId: result.runId }
          : item));
        setError('');
      }
    }).catch(() => {
      if (mounted.current && sequence.current === stoppedSequence) {
        setError('停止请求未确认，请刷新会话核对任务状态');
      }
    });
    active.controller.abort();
    setMessages((current) => current.map((message) => message.id === active.id
      ? { ...message, status: 'stopped', content: `${message.content}\n已停止，保留上一份表单。` }
      : message));
    setStatus('idle');
    setPhase('');
  }, []);

  const reset = useCallback((initial: AIFormDraft | null, restored: ChatMessage[] = [], revision = 0) => {
    sequence.current++;
    run.current?.controller.abort();
    run.current = null;
    const next = initial ? clone(initial) : null;
    draftRef.current = next;
    setDraft(next);
    setMessages(restored);
    setVersion(revision);
    setStatus('idle');
    setPhase('');
    setError('');
    lastMessage.current = '';
  }, []);

  const setTitle = useCallback((title: string) => {
    if (!draftRef.current || run.current) {
      return;
    }
    const next = { ...draftRef.current, title };
    draftRef.current = next;
    setDraft(next);
  }, []);

  const send = useCallback((text: string, resumeRunId?: string): boolean => {
    const message = text.trim();
    if (!message || !draftRef.current || run.current) {
      return false;
    }
    const localId = ++sequence.current;
    const previous = resumeRunId
      ? messages.find(item => item.role === 'assistant' && item.runId === resumeRunId)
      : undefined;
    const id = previous?.id || `assistant-${localId}`;
    const userId = `user-${localId}`;
    const controller = new AbortController();
    const active: ActiveGeneration = { controller, id, userId, provider: generator, runId: resumeRunId };
    run.current = active;
    lastMessage.current = message;
    setError('');
    setStatus('generating');
    setPhase(resumeRunId ? '正在恢复生成…' : '正在生成…');
    setMessages(current => previous
      ? current.map(item => item.id === previous.id ? { ...item, content: '', status: 'generating' } : item)
      : [
          ...current,
          ...(!resumeRunId ? [{ id: userId, role: 'user' as const, content: message, status: 'complete' as const }] : []),
          { id, role: 'assistant', content: '', status: 'generating', runId: resumeRunId },
        ]);
    const currentDraft = clone(draftRef.current);
    const execute = async () => {
      let candidate: AIFormDraft | null = null;
      let completed = false;
      try {
        let serverRevision: number | undefined;
        for await (const event of generator({ message, currentDraft, resumeRunId }, controller.signal)) {
          if (run.current !== active || controller.signal.aborted) {
            return;
          }
          if (event.type === 'accepted') {
            const assistantId = active.id;
            active.runId = event.runId;
            active.id = event.assistantMessageId;
            setMessages(current => current.map(item => {
              if (item.id === assistantId) {
                return { ...item, id: event.assistantMessageId, runId: event.runId, content: '' };
              }
              if (item.id === active.userId) {
                return { ...item, id: event.userMessageId, runId: event.runId };
              }
              return item;
            }));
          } else if (event.type === 'status') {
            setPhase(event.text);
          } else if (event.type === 'text_delta') {
            setMessages((current) => current.map((item) => item.id === active.id
              ? { ...item, content: item.content + event.text }
              : item));
          } else if (event.type === 'replace_text') {
            setMessages(current => current.map(item => item.id === active.id
              ? { ...item, content: event.text, runId: event.runId }
              : item));
          } else if (event.type === 'draft') {
            candidate = clone(event.draft);
          } else if (event.type === 'done') {
            completed = true;
            serverRevision = event.revision;
            break;
          } else if (event.type === 'error') {
            active.interrupted = event.status === 'interrupted';
            active.runId = event.runId;
            throw new Error(event.message);
          }
        }
        if (run.current !== active || controller.signal.aborted) {
          return;
        }
        if (!completed) {
          throw new Error('生成意外中断，请重试');
        }
        if (candidate) {
          draftRef.current = candidate;
          setDraft(candidate);
          setVersion(current => serverRevision === undefined ? current + 1 : serverRevision);
        }
        setMessages((current) => current.map((item) => item.id === active.id
          ? { ...item, status: 'complete' }
          : item));
        setStatus('idle');
      } catch (cause) {
        if (run.current !== active || controller.signal.aborted) {
          return;
        }
        const message = cause instanceof Error ? cause.message : '生成失败';
        setError(message);
        setStatus('error');
        setMessages((current) => current.map((item) => item.id === active.id
          ? {
              ...item,
              status: active.interrupted ? 'interrupted' : 'error',
              runId: active.runId,
              content: `${item.content}\n${message}`,
            }
          : item));
      } finally {
        if (run.current === active) {
          run.current = null;
          setPhase('');
        }
      }
    };
    void execute();
    return true;
  }, [generator, messages]);

  return {
    draft,
    version,
    messages,
    status,
    phase,
    error,
    send,
    stop,
    reset,
    setTitle,
    prependMessages: (older: ChatMessage[]) => setMessages(current => [
      ...older.filter(item => !current.some(existing => existing.id === item.id)),
      ...current,
    ]),
    resume: (runId: string, prompt: string) => send(prompt, runId),
    retry: () => send(lastMessage.current),
  };
};
