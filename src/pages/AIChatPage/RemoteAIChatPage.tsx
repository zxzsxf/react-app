import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Grid, Modal, Popconfirm, Select, Space, Tabs, Tag, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, Document } from '../../lowcode/api';
import { AICapabilities, aiApi, AISession, SessionSummary } from '../../ai-chat/api';
import { createRemoteGenerator } from '../../ai-chat/remote-generator';
import { createSaveAttempt, SaveAttempt, saveNewDraft } from '../../ai-chat/save';
import { StartingPoint } from '../../ai-chat/types';
import { useAIChat } from '../../ai-chat/useAIChat';
import { ChatInput } from './components/ChatInput';
import { ChatMessages } from './components/ChatMessages';
import { FormPreview } from './components/FormPreview';

const errorText = (error: unknown) => error instanceof Error ? error.message : '服务暂时不可用，请重试';

const RemoteAIChatPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const sessionId = new URLSearchParams(location.search).get('sessionId') || '';
  const [session, setSession] = useState<AISession | null>(null);
  const sessionRef = useRef<AISession | null>(null);
  const [capabilities, setCapabilities] = useState<AICapabilities | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [templates, setTemplates] = useState<Document[]>([]);
  const [point, setPoint] = useState<StartingPoint>({ mode: 'blank', templateId: '' });
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const saveAttempt = useRef<SaveAttempt | null>(null);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const loadSequence = useRef(0);
  const wasGenerating = useRef(false);
  const updateSession = useCallback((value: AISession | null) => {
    sessionRef.current = value;
    if (mounted.current) {
      setSession(value);
    }
  }, []);
  const remote = useMemo(() => createRemoteGenerator(() => sessionRef.current, value => {
    if (sessionRef.current?.id === value.id) {
      updateSession(value);
    }
  }), [updateSession]);
  const chat = useAIChat(remote.generator);
  const { reset } = chat;
  const generating = chat.status === 'generating';
  const locked = saving || savePending;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadList = useCallback(async (targetPage: number) => {
    const result = await aiApi.list(targetPage);
    if (mounted.current) {
      setSessions(result.items);
      setTotal(result.total);
      setPage(targetPage);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const results = await Promise.allSettled([aiApi.capabilities(), api.list('templates'), loadList(1)]);
      if (cancelled) {
        return;
      }
      if (results[0].status === 'fulfilled') {
        setCapabilities(results[0].value);
      }
      if (results[1].status === 'fulfilled') {
        setTemplates(results[1].value.filter(item => Boolean(item.publishedVersion)));
      }
      const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failure) {
        setError(errorText(failure.reason));
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [loadList]);

  const loadSession = useCallback(async (id: string) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError('');
    reset(null);
    updateSession(null);
    setInput('');
    setSavePending(false);
    saveAttempt.current = null;
    try {
      if (!id) {
        setNextBefore(null);
        return;
      }
      const [value, history] = await Promise.all([aiApi.get(id), aiApi.messages(id)]);
      if (!mounted.current || sequence !== loadSequence.current) {
        return;
      }
      updateSession(value);
      reset(value.draft, history.items, value.revision);
      setNextBefore(history.nextBefore);
    } catch (cause) {
      if (mounted.current && sequence === loadSequence.current) {
        setError(errorText(cause));
      }
    } finally {
      if (mounted.current && sequence === loadSequence.current) {
        setLoading(false);
      }
    }
  }, [reset, updateSession]);

  useEffect(() => { void loadSession(sessionId); }, [sessionId, loadSession]);

  useEffect(() => {
    if (generating) {
      wasGenerating.current = true;
      return;
    }
    if (!wasGenerating.current || !sessionId) {
      return;
    }
    wasGenerating.current = false;
    let cancelled = false;
    void aiApi.get(sessionId).then(value => {
      if (cancelled || !mounted.current || sessionRef.current?.id !== value.id) {
        return;
      }
      updateSession(value);
      return loadList(page);
    }).catch(cause => {
      if (!cancelled && mounted.current) {
        setError(errorText(cause));
      }
    });
    return () => { cancelled = true; };
  }, [generating, sessionId, updateSession, loadList, page]);

  const act = async (action: () => Promise<void>) => {
    setError('');
    try {
      await action();
    } catch (cause) {
      if (mounted.current) {
        setError(errorText(cause));
      }
    }
  };

  const switchSession = (id: string) => {
    const action = () => navigate(`/ai-chat?sessionId=${encodeURIComponent(id)}`);
    if (input.trim() || chat.draft?.title !== session?.draft.title) {
      Modal.confirm({
        title: '切换会话？',
        content: '未发送的输入和未同步的标题将被清空，已保存的聊天记录会保留。',
        onOk: action,
      });
    } else {
      action();
    }
  };

  const create = () => {
    const action = () => act(async () => {
      if (point.mode === 'template' && !point.templateId) {
        throw new Error('请选择已发布模板');
      }
      setLoading(true);
      try {
        const value = await aiApi.create(point);
        await loadList(1);
        if (mounted.current) {
          navigate(`/ai-chat?sessionId=${encodeURIComponent(value.id)}`);
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    });
    if (input.trim() || chat.draft?.title !== session?.draft.title) {
      Modal.confirm({
        title: '新建会话？',
        content: '当前未发送的输入和未同步的标题将被清空，聊天记录会保留。',
        onOk: action,
      });
    } else {
      void action();
    }
  };

  const save = () => act(async () => {
    if (savingRef.current || generating || !chat.draft) {
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      if (!saveAttempt.current) {
        await remote.flushTitle(chat.draft);
        saveAttempt.current = createSaveAttempt(chat.draft);
      }
      setSavePending(true);
      const id = await saveNewDraft(saveAttempt.current);
      if (mounted.current) {
        navigate(`/form-builder/${id}`);
      }
    } catch (cause) {
      if (!saveAttempt.current?.attempted) {
        saveAttempt.current = null;
        setSavePending(false);
      }
      throw cause;
    } finally {
      savingRef.current = false;
      if (mounted.current) {
        setSaving(false);
      }
    }
  });

  const disabled = loading || locked || !session || !capabilities?.configured || Boolean(session.activeRunId);
  const lastRun = session?.lastRun;
  const chatPanel = (
    <section className="ai-chat-conversation" aria-label="表单助手">
      <div className="ai-chat-panel-heading">
        <h2>表单助手</h2>
        <span>{session?.title || '请新建或选择会话'}</span>
      </div>
      {nextBefore && (
        <Button disabled={generating} onClick={() => void act(async () => {
          const history = await aiApi.messages(sessionId, nextBefore);
          chat.prependMessages(history.items);
          setNextBefore(history.nextBefore);
        })}>加载更早消息</Button>
      )}
      <ChatMessages
        messages={chat.messages}
        phase={chat.phase}
        disabled={disabled || generating}
        onExample={setInput}
        mock={capabilities?.provider === 'mock'}
      />
      {chat.error && <Alert type="error" message={chat.error} />}
      {lastRun?.status === 'interrupted' && !generating && (
        <Alert type="warning" message="上次生成已中断，当前表单已保留。" action={
          <Button disabled={disabled} onClick={() => chat.resume(lastRun.id, lastRun.prompt)}>恢复生成</Button>
        } />
      )}
      {(chat.status === 'error' || lastRun?.status === 'failed' || lastRun?.status === 'cancelled') && (
        <Button disabled={disabled || generating} onClick={() => {
          if (lastRun) {
            chat.send(lastRun.prompt);
          } else {
            chat.retry();
          }
        }}>重新生成</Button>
      )}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={() => {
          if (!disabled && chat.send(input)) {
            setInput('');
          }
        }}
        onStop={chat.stop}
        generating={generating}
        disabled={disabled}
      />
    </section>
  );
  const previewPanel = (
    <FormPreview
      key={sessionId}
      draft={chat.draft}
      version={Math.max(chat.version, session?.revision || 0)}
      locked={loading || locked || Boolean(session?.activeRunId)}
      generating={generating}
      saving={saving}
      canSave={Boolean(chat.draft) && !loading && !generating && !session?.activeRunId && !saving}
      retrySave={savePending}
      onTitleChange={chat.setTitle}
      onSave={save}
    />
  );
  const options = sessions.map(value => ({ value: value.id, label: value.title }));
  if (session && !options.some(option => option.value === session.id)) {
    options.unshift({ value: session.id, label: session.title });
  }

  return (
    <div className="ai-chat-page">
      <header className="ai-chat-header">
        <div>
          <Space>
            <Typography.Title level={2}>AI 表单</Typography.Title>
            <Tag color={capabilities?.provider === 'mock' ? 'gold' : 'blue'}>
              {capabilities?.provider === 'mock' ? '服务端模拟' : '模型生成'}
            </Tag>
          </Space>
          <p>对话生成、版本预览，保存后继续搭建。会话支持刷新恢复。</p>
        </div>
        <Button icon={<PlusOutlined />} disabled={loading || locked || generating} onClick={() => void create()}>
          新建会话
        </Button>
      </header>
      {error && <Alert type="error" message={error} />}
      {capabilities && !capabilities.configured && (
        <Alert type="warning" message="模型尚未配置。请在服务端配置模型地址、模型 ID 和密钥后重启服务。" />
      )}
      {capabilities?.provider === 'mock' && <Alert type="info" message="当前服务显式启用了 mock，未调用真实模型。" />}
      <Space wrap>
        <Select
          aria-label="历史会话"
          placeholder="选择历史会话"
          style={{ minWidth: 220 }}
          options={options}
          value={sessionId || undefined}
          disabled={loading || locked || generating}
          onChange={switchSession}
        />
        <Button disabled={page <= 1 || generating} onClick={() => void act(() => loadList(page - 1))}>上一页</Button>
        <span>{page} / {Math.max(1, Math.ceil(total / 20))}</span>
        <Button disabled={page * 20 >= total || generating} onClick={() => void act(() => loadList(page + 1))}>下一页</Button>
        <Button icon={<ReloadOutlined />} disabled={loading || locked || generating} onClick={() => void loadSession(sessionId)}>
          刷新会话
        </Button>
        <Popconfirm title="删除此会话？" onConfirm={() => act(async () => {
          await aiApi.remove(sessionId);
          navigate('/ai-chat');
          await loadList(1);
        })}>
          <Button danger disabled={!session || loading || locked || generating || Boolean(session.activeRunId)}>删除会话</Button>
        </Popconfirm>
      </Space>
      <Space wrap>
        <span>新会话起步方式</span>
        <Select
          aria-label="起步方式"
          value={point.mode}
          options={[{ value: 'blank', label: '空白表单' }, { value: 'template', label: '已发布模板' }]}
          disabled={generating || locked || loading}
          onChange={mode => setPoint({ mode, templateId: '' })}
        />
        {point.mode === 'template' && (
          <Select
            aria-label="已发布模板"
            placeholder="选择已发布模板"
            value={point.templateId || undefined}
            style={{ minWidth: 220 }}
            options={templates.map(template => ({ value: template.id.replace(/^template:/, ''), label: template.title }))}
            onChange={templateId => setPoint({ mode: 'template', templateId })}
          />
        )}
      </Space>
      {session?.activeRunId && !generating && (
        <Alert type="info" message="该会话仍有生成任务，请刷新状态或停止后继续。" action={
          <Button onClick={() => void act(async () => {
            await aiApi.cancel(session.activeRunId!);
            await loadSession(session.id);
          })}>停止任务</Button>
        } />
      )}
      {savePending && !saving && <Alert type="warning" message="保存结果尚未确认，候选已锁定，请重试保存以核对结果。" />}
      {loading && <div role="status">正在读取会话…</div>}
      {screens.lg ? (
        <div className="ai-chat-workspace">{chatPanel}{previewPanel}</div>
      ) : (
        <Tabs defaultActiveKey="chat" destroyInactiveTabPane={false}>
          <Tabs.TabPane tab="聊天" key="chat">{chatPanel}</Tabs.TabPane>
          <Tabs.TabPane tab="预览" key="preview" forceRender>{previewPanel}</Tabs.TabPane>
        </Tabs>
      )}
    </div>
  );
};

export default RemoteAIChatPage;
