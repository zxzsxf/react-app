import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Grid, Modal, Select, Space, Tabs, Tag, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ApiError, Document } from '../../lowcode/api';
import { BlankCatalog, loadBlankCatalog, loadStartingDraft, loadTemplates } from '../../ai-chat/catalog';
import { createSaveAttempt, SaveAttempt, saveNewDraft } from '../../ai-chat/save';
import { StartingPoint } from '../../ai-chat/types';
import { useAIChat } from '../../ai-chat/useAIChat';
import { ChatInput } from './components/ChatInput';
import { ChatMessages } from './components/ChatMessages';
import { FormPreview } from './components/FormPreview';
import './AIChatPage.css';
import RemoteAIChatPage from './RemoteAIChatPage';

const emptyCatalog: BlankCatalog = { locks: {}, warnings: [] };
const initialPoint: StartingPoint = { mode: 'blank', templateId: '' };
const errorText = (cause: unknown): string => {
  if (cause instanceof ApiError && cause.status === 401) {
    return '登录已失效，请重新登录后重试';
  }
  if (cause instanceof ApiError && cause.status === 403) {
    return '没有操作权限或登录校验已失效，请重新登录';
  }
  return cause instanceof Error ? cause.message : '服务暂时不可用，请重试';
};

export const LocalAIChatPage: React.FC = () => {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const chat = useAIChat();
  const { reset } = chat;
  const [point, setPoint] = useState<StartingPoint>(initialPoint);
  const pointRef = useRef(point);
  const [catalog, setCatalog] = useState<BlankCatalog>(emptyCatalog);
  const [templates, setTemplates] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [resourceErrors, setResourceErrors] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [baselineTitle, setBaselineTitle] = useState('');
  const saveAttempt = useRef<SaveAttempt | null>(null);
  const saveBusy = useRef(false);
  const loadSequence = useRef(0);
  const mounted = useRef(true);
  const confirmDialog = useRef<ReturnType<typeof Modal.confirm> | null>(null);

  useEffect(() => {
    mounted.current = true;
    const sequence = ++loadSequence.current;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      reset(null);
      const [catalogResult, templatesResult] = await Promise.allSettled([
        loadBlankCatalog(),
        loadTemplates(),
      ]);
      if (!mounted.current || sequence !== loadSequence.current) {
        return;
      }
      const nextCatalog = catalogResult.status === 'fulfilled' ? catalogResult.value : emptyCatalog;
      setCatalog(nextCatalog);
      setTemplates(templatesResult.status === 'fulfilled' ? templatesResult.value : []);
      setResourceErrors([
        ...(catalogResult.status === 'rejected' ? [`组件目录读取失败：${errorText(catalogResult.reason)}`] : []),
        ...(templatesResult.status === 'rejected' ? [`模板列表读取失败：${errorText(templatesResult.reason)}`] : []),
      ]);
      try {
        if (pointRef.current.mode === 'blank' && catalogResult.status === 'rejected') {
          throw catalogResult.reason;
        }
        if (pointRef.current.mode === 'template' && !pointRef.current.templateId) {
          return;
        }
        const draft = await loadStartingDraft(pointRef.current, nextCatalog);
        if (mounted.current && sequence === loadSequence.current) {
          reset(draft);
          setBaselineTitle(draft.title);
        }
      } catch (cause) {
        if (mounted.current && sequence === loadSequence.current) {
          setLoadError(errorText(cause));
        }
      } finally {
        if (mounted.current && sequence === loadSequence.current) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted.current = false;
      confirmDialog.current?.destroy();
    };
  }, [reloadKey, reset]);

  const generating = chat.status === 'generating';
  const locked = saving || savePending;
  const dirty = chat.messages.length > 0 || chat.version > 0 || Boolean(input.trim()) ||
    Boolean(chat.draft && chat.draft.title !== baselineTitle) || savePending;

  const confirmReset = (action: () => void) => {
    if (saving) {
      return;
    }
    if (!dirty) {
      action();
      return;
    }
    confirmDialog.current?.destroy();
    confirmDialog.current = Modal.confirm({
      title: '清空当前会话？',
      content: savePending
        ? '当前聊天和候选表单将被清空。上次保存结果尚未确认，建议先重试保存。'
        : '当前聊天、输入和候选表单将被清空，正在运行的生成也会停止。',
      okText: '清空并继续',
      cancelText: '保留当前内容',
      onOk: action,
    });
  };

  const clearSession = () => {
    chat.stop();
    reset(null);
    setInput('');
    setSaveError('');
    setSavePending(false);
    saveAttempt.current = null;
  };

  const changePoint = (next: StartingPoint, force = false) => {
    if (!force && next.mode === point.mode && next.templateId === point.templateId) {
      return;
    }
    confirmReset(() => {
      clearSession();
      pointRef.current = next;
      setPoint(next);
      const sequence = ++loadSequence.current;
      setLoadError('');
      if (next.mode === 'template' && !next.templateId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      void loadStartingDraft(next, catalog).then((draft) => {
        if (mounted.current && sequence === loadSequence.current) {
          reset(draft);
          setBaselineTitle(draft.title);
        }
      }).catch((cause) => {
        if (mounted.current && sequence === loadSequence.current) {
          setLoadError(errorText(cause));
        }
      }).finally(() => {
        if (mounted.current && sequence === loadSequence.current) {
          setLoading(false);
        }
      });
    });
  };

  const reload = () => confirmReset(() => {
    clearSession();
    setReloadKey((key) => key + 1);
  });

  const send = () => {
    if (!locked && !loading && chat.send(input)) {
      setInput('');
      setSaveError('');
    }
  };

  const save = async () => {
    if (saveBusy.current || loading || generating || !chat.draft) {
      return;
    }
    saveBusy.current = true;
    setSaving(true);
    setSaveError('');
    try {
      if (!saveAttempt.current) {
        saveAttempt.current = createSaveAttempt(chat.draft);
      }
      setSavePending(true);
      const id = await saveNewDraft(saveAttempt.current);
      if (mounted.current) {
        navigate(`/form-builder/${id}`);
      }
    } catch (cause) {
      if (mounted.current) {
        setSaveError(errorText(cause));
        // 明确的参数或权限错误没有创建草稿，允许调整后重试。
        if (!saveAttempt.current?.attempted) {
          saveAttempt.current = null;
          setSavePending(false);
        }
      }
    } finally {
      saveBusy.current = false;
      if (mounted.current) {
        setSaving(false);
      }
    }
  };

  const disabled = loading || locked || !chat.draft;
  const hasInput = Boolean(chat.draft?.componentLocks.Input);
  const chatPanel = (
    <section className="ai-chat-conversation" aria-label="表单助手">
      <div className="ai-chat-panel-heading"><h2>表单助手</h2><span>支持下方固定指令</span></div>
      <ChatMessages messages={chat.messages} phase={chat.phase} disabled={disabled || generating} onExample={setInput} />
      {chat.error && (
        <Alert type="error" message={chat.error} action={<Button size="small" disabled={disabled} onClick={chat.retry}>重试生成</Button>} />
      )}
      {chat.messages[chat.messages.length - 1]?.status === 'stopped' && (
        <div className="ai-chat-retry">
          <Button size="small" disabled={disabled} onClick={chat.retry}>重新生成</Button>
        </div>
      )}
      {!loading && chat.draft && !hasInput && (
        <Alert type="warning" message="当前没有可用 Input，可修改已有字段或标题；新增字段需先配置组件或更换模板。" />
      )}
      <ChatInput value={input} onChange={setInput} onSend={send} onStop={chat.stop} generating={generating} disabled={disabled} />
    </section>
  );
  const previewPanel = (
    <FormPreview
      key={`${point.mode}:${point.templateId}:${reloadKey}`}
      draft={chat.draft}
      version={chat.version}
      locked={locked || loading}
      generating={generating}
      saving={saving}
      canSave={Boolean(chat.draft) && !loading && !generating && !saving}
      retrySave={savePending}
      onTitleChange={chat.setTitle}
      onSave={save}
    />
  );

  return (
    <div className="ai-chat-page">
      <header className="ai-chat-header">
        <div>
          <Space><Typography.Title level={2}>AI 表单</Typography.Title><Tag color="gold">模拟生成</Tag></Space>
          <p>用对话整理需求，用真实组件预览，保存后继续搭建。</p>
        </div>
        <Button icon={<PlusOutlined />} disabled={loading || saving} onClick={() => changePoint(point, true)}>新建会话</Button>
      </header>
      <Alert type="info" showIcon message="当前为固定规则模拟，不调用模型。组件、模板和保存使用真实服务；刷新页面会清空会话。" />
      <div className="ai-chat-starting-point">
        <Space wrap>
          <span>起步方式</span>
          <Select
            aria-label="起步方式"
            value={point.mode}
            disabled={loading || locked}
            options={[{ value: 'blank', label: '空白表单' }, { value: 'template', label: '已发布模板' }]}
            onChange={(mode) => changePoint({ mode, templateId: '' })}
          />
          {point.mode === 'template' && (
            <Select
              aria-label="已发布模板"
              placeholder="选择已发布模板"
              value={point.templateId || undefined}
              disabled={loading || locked}
              style={{ minWidth: 220 }}
              options={templates.map((template) => ({
                value: template.id.replace(/^template:/, ''),
                label: `${template.title} v${template.publishedVersion}`,
              }))}
              notFoundContent="暂无已发布模板，请先在模板管理中发布"
              onChange={(templateId) => changePoint({ mode: 'template', templateId })}
            />
          )}
          <Button icon={<ReloadOutlined />} loading={loading} disabled={locked} onClick={reload}>重新加载配置</Button>
        </Space>
        <span className="ai-chat-source-note">{point.mode === 'blank' ? '使用已启用组件的精确版本与已发布配置' : '复制发布快照，保留模板组件版本'}</span>
      </div>
      {[...resourceErrors, ...(point.mode === 'blank' ? catalog.warnings : [])].map((warning) => (
        <Alert key={warning} type="warning" message={warning} />
      ))}
      {loadError && <Alert type="error" message={`起步配置加载失败：${loadError}`} action={<Button size="small" onClick={reload}>重试加载</Button>} />}
      {saveError && <Alert type="error" message={`保存失败：${saveError}`} />}
      {savePending && !saving && (
        <Alert type="warning" message="保存结果尚未确认，当前候选已锁定。请点击“重试保存”，先检查是否已创建，避免重复保存。" />
      )}
      {loading && <div role="status">正在读取真实组件和起步配置…</div>}
      {screens.lg ? (
        <div className="ai-chat-workspace">{chatPanel}{previewPanel}</div>
      ) : (
        <Tabs className="ai-chat-mobile-tabs" defaultActiveKey="chat" destroyInactiveTabPane={false}>
          <Tabs.TabPane tab="聊天" key="chat">{chatPanel}</Tabs.TabPane>
          <Tabs.TabPane tab="预览" key="preview" forceRender>{previewPanel}</Tabs.TabPane>
        </Tabs>
      )}
    </div>
  );
};

export default RemoteAIChatPage;
