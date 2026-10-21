import React, { useRef } from 'react';
import { Button, Input } from 'antd';
import { SendOutlined, StopOutlined } from '@ant-design/icons';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  generating: boolean;
  disabled: boolean;
}

export const ChatInput: React.FC<Props> = ({
  value, onChange, onSend, onStop, generating, disabled,
}) => {
  const composing = useRef(false);
  const compositionEndedAt = useRef(0);
  return (
    <div className="ai-chat-input">
      <Input.TextArea
        aria-label="表单需求"
        value={value}
        maxLength={1000}
        disabled={disabled || generating}
        autoSize={{ minRows: 3, maxRows: 6 }}
        placeholder="描述表单需求，或点击上方示例指令"
        onChange={(event) => onChange(event.target.value)}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => {
          composing.current = false;
          compositionEndedAt.current = Date.now();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !composing.current &&
            !event.nativeEvent.isComposing && event.keyCode !== 229 &&
            Date.now() - compositionEndedAt.current > 50) {
            event.preventDefault();
            if (!disabled && !generating) {
              onSend();
            }
          }
        }}
      />
      <div className="ai-chat-input-footer">
        <span>Enter 发送 · Shift+Enter 换行</span>
        {generating ? (
          <Button icon={<StopOutlined />} onClick={onStop}>停止生成</Button>
        ) : (
          <Button type="primary" icon={<SendOutlined />} disabled={disabled || !value.trim()} onClick={onSend}>
            发送
          </Button>
        )}
      </div>
    </div>
  );
};
