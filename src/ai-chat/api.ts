import { ApiError, lowcodeHeaders } from '../lowcode/api';
import { AIFormDraft, ChatMessage, StartingPoint } from './types';

export interface AIRun {
  id: string;
  sessionId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  prompt: string;
  assistantMessageId: string;
  userMessageId: string;
  reply: string;
  error: string | null;
  resultDraft: AIFormDraft | null;
  resultRevision: number | null;
}

export interface AISession {
  id: string;
  title: string;
  source: StartingPoint;
  draft: AIFormDraft;
  revision: number;
  activeRunId: string | null;
  lastRun?: AIRun | null;
}

export interface AICapabilities {
  provider: 'mock' | 'openai-compatible';
  configured: boolean;
  components: string[];
}

export interface SessionSummary {
  id: string;
  title: string;
  revision: number;
  updatedAt: string;
  source: StartingPoint;
}

export class AIError extends ApiError {
  constructor(message: string, status: number, public readonly runId?: string) {
    super(message, status);
  }
}

export async function aiRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/lowcode/ai${path}`, {
    method,
    credentials: 'same-origin',
    headers: { ...lowcodeHeaders(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(result.message) ? result.message.join('；') : result.message;
    throw new AIError(message || `AI 服务请求失败 (${response.status})`, response.status, result.runId);
  }
  return result as T;
}

export const aiApi = {
  capabilities: () => aiRequest<AICapabilities>('/capabilities'),
  list: (page = 1) => aiRequest<{ items: SessionSummary[]; total: number }>(`/sessions?page=${page}`),
  create: (source: StartingPoint) => aiRequest<AISession>('/sessions', 'POST', { source }),
  get: (id: string) => aiRequest<AISession>(`/sessions/${id}`),
  rename: (id: string, title: string) => aiRequest<AISession>(`/sessions/${id}`, 'PATCH', { title }),
  remove: (id: string) => aiRequest(`/sessions/${id}`, 'DELETE'),
  messages: (id: string, before?: number) => aiRequest<{ items: ChatMessage[]; nextBefore: number | null }>(
    `/sessions/${id}/messages${before ? `?before=${before}` : ''}`,
  ),
  title: (id: string, title: string, expectedRevision: number) => aiRequest<AISession>(
    `/sessions/${id}/draft`, 'PATCH', { title, expectedRevision },
  ),
  run: (id: string) => aiRequest<AIRun>(`/runs/${id}`),
  request: (sessionId: string, requestId: string) => aiRequest<AIRun>(`/sessions/${sessionId}/requests/${requestId}`),
  cancel: (id: string) => aiRequest<AIRun>(`/runs/${id}/cancel`, 'POST', {}),
};
