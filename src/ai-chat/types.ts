import type { ComponentLock, SchemaNode } from '../lowcode/api';

export interface AIFormDraft {
  title: string;
  schema: SchemaNode;
  componentLocks: Record<string, ComponentLock>;
}

export type GenerationEvent =
  | { type: 'accepted'; runId: string; assistantMessageId: string; userMessageId: string }
  | { type: 'status'; text: string; runId?: string }
  | { type: 'text_delta'; text: string; runId?: string }
  | { type: 'replace_text'; text: string; runId: string }
  | { type: 'draft'; draft: AIFormDraft; runId?: string }
  | { type: 'done'; revision?: number; runId?: string }
  | { type: 'error'; message: string; status: string; runId: string };

export interface GenerateInput {
  message: string;
  currentDraft: AIFormDraft;
  resumeRunId?: string;
}

export type Generator = ((
  input: GenerateInput,
  signal: AbortSignal,
) => AsyncIterable<GenerationEvent>) & {
  cancel?: () => Promise<void | {
    draft: AIFormDraft;
    revision: number;
    reply: string;
    runId: string;
    assistantMessageId: string;
    userMessageId: string;
  }>;
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'generating' | 'stopped' | 'error' | 'interrupted';
  runId?: string;
  sequence?: number;
}

export interface StartingPoint {
  mode: 'blank' | 'template';
  templateId: string;
}

export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
