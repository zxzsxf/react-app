import React, { useLayoutEffect, useRef } from 'react';
import { Button, Spin } from 'antd';
import { ChatMessage } from '../../../ai-chat/types';
import { examplePrompts } from '../../../ai-chat/mock-generator';

interface Props {
  messages: ChatMessage[];
  phase: string;
  disabled: boolean;
  onExample: (text: string) => void;
  mock?: boolean;
}

export const ChatMessages: React.FC<Props> = ({ messages, phase, disabled, onExample, mock = true }) => {
  const container = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useLayoutEffect(() => {
    if (!messages.length) {
      following.current = true;
    }
    if (following.current && container.current) {
      container.current.scrollTop = container.current.scrollHeight;
    }
  }, [messages, phase]);
  return (
    <div
      ref={container}
      className="ai-chat-messages"
      aria-label="聊天记录"
      onScroll={() => {
        const element = container.current!;
        following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
      }}
    >
      {!messages.length && (
        <div className="ai-chat-welcome">
          <h2>从一个需求开始</h2>
          <p>{mock ? '描述字段和要求，在右侧体验真实表单。当前回复由固定规则模拟。' : '描述表单字段和要求，生成结果通过校验后将在右侧展示。'}</p>
        </div>
      )}
      {messages.map((message) => (
        <article key={message.id} className={`ai-chat-message is-${message.role}`}>
          <div className="ai-chat-message-author">
            {message.role === 'user' ? '你' : mock ? '表单助手 · 模拟' : '表单助手'}
          </div>
          <div className="ai-chat-bubble">
            {message.content}
            {message.status === 'generating' && (
              <div className="ai-chat-thinking" role="status"><Spin size="small" />{phase}</div>
            )}
          </div>
        </article>
      ))}
      <div className="ai-chat-examples">
        <span>{mock ? '模拟指令' : '试试这些需求'}</span>
        {examplePrompts.map((text) => (
          <Button key={text} size="small" disabled={disabled} onClick={() => onExample(text)}>
            {text}
          </Button>
        ))}
      </div>
    </div>
  );
};
