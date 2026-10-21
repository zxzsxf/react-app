import React, { useRef, useState } from 'react';
import { Alert, Button, Empty, Input, Space, Tag } from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { LowCodeRenderer, MobileFormHandle } from '../../../lowcode/MobileRenderer';
import { AIFormDraft } from '../../../ai-chat/types';

class PreviewBoundary extends React.Component<{
  children: React.ReactNode;
  onRetry: () => void;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <Alert type="error" message="表单组件加载或渲染失败" action={<Button onClick={this.props.onRetry}>重试预览</Button>} />;
    }
    return this.props.children;
  }
}

interface Props {
  draft: AIFormDraft | null;
  version: number;
  locked: boolean;
  generating: boolean;
  saving: boolean;
  canSave: boolean;
  retrySave: boolean;
  onTitleChange: (title: string) => void;
  onSave: () => void;
}

const PreviewBody: React.FC<{ draft: AIFormDraft; resetKey: number }> = ({ draft, resetKey }) => {
  const formRef = useRef<MobileFormHandle>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const validate = async () => {
    if (!formRef.current) {
      setFeedback({ error: true, text: '表单尚未就绪，请稍后重试' });
      return;
    }
    try {
      const values = await formRef.current.submit();
      setFeedback({ error: false, text: `校验通过：${JSON.stringify(values)}` });
    } catch {
      setFeedback({ error: true, text: '请检查未通过校验的字段，或确认远程组件已正常加载' });
    }
  };
  return (
    <>
      <div className="ai-chat-device">
        <div className="ai-chat-device-bar">表单预览</div>
        <h3>{draft.title || '未命名表单'}</h3>
        <LowCodeRenderer key={resetKey} schema={draft.schema} locks={draft.componentLocks} formRef={formRef} />
      </div>
      <Button onClick={validate}>校验并查看表单值</Button>
      {feedback && <Alert type={feedback.error ? 'error' : 'success'} message={feedback.text} />}
    </>
  );
};

export const FormPreview: React.FC<Props> = ({
  draft, version, locked, generating, saving, canSave, retrySave, onTitleChange, onSave,
}) => {
  const [resetKey, setResetKey] = useState(0);
  return (
    <section className="ai-chat-preview" aria-label="表单预览">
      <div className="ai-chat-panel-heading">
        <div><h2>表单预览</h2><Tag>候选 v{version}</Tag></div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} disabled={!draft} onClick={() => setResetKey((key) => key + 1)}>
            重置填写值
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!canSave} onClick={onSave}>
            {retrySave ? '重试保存' : '保存并继续编辑'}
          </Button>
        </Space>
      </div>
      <label className="ai-chat-title-field">
        <span>表单名称</span>
        <Input
          aria-label="表单名称"
          value={draft?.title || ''}
          disabled={!draft || locked || generating}
          maxLength={160}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </label>
      <div className="ai-chat-preview-content">
        {generating && <div className="ai-chat-preview-status" role="status">正在生成，当前预览保持不变…</div>}
        {draft ? (
          <PreviewBoundary key={`${version}:${resetKey}`} onRetry={() => setResetKey((key) => key + 1)}>
            <PreviewBody key={`${version}:${resetKey}`} draft={draft} resetKey={resetKey} />
          </PreviewBoundary>
        ) : <Empty description="请先加载起步配置" />}
        <p className="ai-chat-preview-note">预览校验仅展示结果；保存将创建真实的业务表单草稿。</p>
      </div>
    </section>
  );
};
