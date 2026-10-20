import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Button } from 'antd';
import { SchemaNode } from './api';
import {
  isManageMessage,
  MANAGE_CHANNEL,
  MANAGE_VERSION,
  ManageMessage,
} from './manage-editor-protocol';

const TIMEOUT = 15000;

interface Props {
  kind: 'templates' | 'component-configs';
  id: string;
  schema: SchemaNode;
  onReadyChange: (ready: boolean) => void;
  onSave: () => void;
}

export interface FlowformManageEditorHandle {
  readSchema: () => Promise<SchemaNode>;
}

interface PendingRequest {
  expected: ManageMessage['type'];
  resolve: (message: ManageMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  retryTimer?: ReturnType<typeof setInterval>;
}

export const FlowformManageEditor = forwardRef<FlowformManageEditorHandle, Props>(
  ({ kind, id, schema, onReadyChange, onSave }, ref) => {
    const iframe = useRef<HTMLIFrameElement>(null);
    const pending = useRef(new Map<string, PendingRequest>());
    const schemaRef = useRef(schema);
    const callbacks = useRef({ onReadyChange, onSave });
    const ready = useRef(false);
    const sequence = useRef(0);
    const generation = useRef(0);
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState('');
    schemaRef.current = schema;
    callbacks.current = { onReadyChange, onSave };

    const target = useMemo(() => {
      try {
        const base =
          process.env.REACT_APP_FLOWFORM_EDITOR_URL ||
          (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:6575/editor' : '');
        if (!base) throw new Error('未配置线上表单编辑器地址');
        const url = new URL(base);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('表单编辑器地址必须使用 HTTP 或 HTTPS');
        }
        const sessionId = `${crypto.randomUUID()}:${id}:${attempt}`;
        url.searchParams.set('flowformMode', 'manage');
        url.searchParams.set('kind', kind);
        url.searchParams.set('parentOrigin', window.location.origin);
        url.searchParams.set('sessionId', sessionId);
        return { url: url.toString(), origin: url.origin, sessionId, error: '' };
      } catch (cause) {
        return { url: '', origin: '', sessionId: '', error: (cause as Error).message };
      }
    }, [kind, id, attempt]);

    const cancelRequests = useCallback((message: string) => {
      pending.current.forEach((request) => {
        clearTimeout(request.timer);
        clearInterval(request.retryTimer);
        request.reject(new Error(message));
      });
      pending.current.clear();
    }, []);

    const request = useCallback(
      (
        type: 'connect' | 'initialize' | 'read-schema',
        expected: ManageMessage['type'],
      ): Promise<ManageMessage> =>
        new Promise((resolve, reject) => {
          const frame = iframe.current?.contentWindow;
          if (!frame || !target.url) {
            reject(new Error('编辑器尚未加载'));
            return;
          }
          const requestId = `${target.sessionId}:${++sequence.current}`;
          const timer = setTimeout(() => {
            clearInterval(pending.current.get(requestId)?.retryTimer);
            pending.current.delete(requestId);
            reject(new Error('编辑器通信超时，请重试'));
          }, TIMEOUT);
          pending.current.set(requestId, { expected, resolve, reject, timer });
          const envelope = {
            channel: MANAGE_CHANNEL,
            version: MANAGE_VERSION,
            sessionId: target.sessionId,
            requestId,
          } as const;
          const message: ManageMessage =
            type === 'initialize'
              ? { ...envelope, type, schema: schemaRef.current }
              : { ...envelope, type };
          frame.postMessage(message, target.origin);
          if (type === 'connect') {
            const waiting = pending.current.get(requestId)!;
            // The frame's load event may precede React's message listener effect.
            waiting.retryTimer = setInterval(() => frame.postMessage(message, target.origin), 500);
          }
        }),
      [target],
    );

    useImperativeHandle(
      ref,
      () => ({
        async readSchema() {
          if (!ready.current) throw new Error('编辑器尚未就绪');
          const currentGeneration = generation.current;
          try {
            const message = await request('read-schema', 'schema');
            if (message.type !== 'schema') throw new Error('编辑器返回了无效的设计数据');
            return message.schema as SchemaNode;
          } catch (cause) {
            if (generation.current === currentGeneration) {
              ready.current = false;
              callbacks.current.onReadyChange(false);
              setError((cause as Error).message);
            }
            throw cause;
          }
        },
      }),
      [request],
    );

    useEffect(() => {
      ready.current = false;
      callbacks.current.onReadyChange(false);
      const loadTimer = setTimeout(() => {
        if (!ready.current) setError('编辑器加载超时，请检查服务后重试');
      }, TIMEOUT);
      const receive = (event: MessageEvent) => {
        if (
          event.origin !== target.origin ||
          event.source !== iframe.current?.contentWindow ||
          !isManageMessage(event.data) ||
          event.data.sessionId !== target.sessionId
        )
          return;
        const message = event.data;
        if (message.type === 'save') {
          if (ready.current) callbacks.current.onSave();
          return;
        }
        const waiting = pending.current.get(message.requestId);
        if (!waiting || (message.type !== waiting.expected && message.type !== 'error')) return;
        pending.current.delete(message.requestId);
        clearTimeout(waiting.timer);
        clearInterval(waiting.retryTimer);
        if (message.type === 'error') waiting.reject(new Error(message.message));
        else waiting.resolve(message);
      };
      window.addEventListener('message', receive);
      return () => {
        generation.current += 1;
        ready.current = false;
        clearTimeout(loadTimer);
        window.removeEventListener('message', receive);
        cancelRequests('编辑器会话已关闭');
        callbacks.current.onReadyChange(false);
      };
    }, [target, cancelRequests]);

    const connect = async () => {
      const session = target.sessionId;
      const currentGeneration = ++generation.current;
      ready.current = false;
      callbacks.current.onReadyChange(false);
      cancelRequests('编辑器已重新加载');
      setError('');
      try {
        await request('connect', 'ready');
        if (generation.current !== currentGeneration) return;
        await request('initialize', 'initialized');
        if (generation.current !== currentGeneration) return;
        ready.current = true;
        setError('');
        callbacks.current.onReadyChange(true);
      } catch (cause) {
        if (generation.current === currentGeneration && iframe.current?.dataset.session === session)
          setError((cause as Error).message);
      }
    };

    return (
      <div>
        {(target.error || error) && (
          <Alert
            type="error"
            message={target.error || error}
            action={<Button onClick={() => setAttempt((value) => value + 1)}>重试</Button>}
            style={{ marginBottom: 12 }}
          />
        )}
        {target.url && (
          <iframe
            key={target.sessionId}
            ref={iframe}
            data-session={target.sessionId}
            title="低代码管理设计器"
            src={target.url}
            onLoad={connect}
            onError={() => {
              generation.current += 1;
              ready.current = false;
              callbacks.current.onReadyChange(false);
              cancelRequests('编辑器加载失败');
              setError('编辑器加载失败，请检查服务后重试');
            }}
            style={{ width: '100%', height: 'calc(100vh - 270px)', minHeight: 520, border: 0 }}
          />
        )}
      </div>
    );
  },
);
