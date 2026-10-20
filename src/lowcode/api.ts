export type Role = 'M' | 'B' | 'C';
export interface User { id: string; username: string; roles: Role[]; csrf: string }
export interface SchemaNode {
  'x-index'?: number;
  type: string; title?: string; required?: boolean;
  properties?: Record<string, SchemaNode>;
  'x-component'?: string;
  'x-decorator'?: string;
  'x-component-props'?: Record<string, unknown>;
}
export interface ComponentLock {
  kind?: 'field' | 'container';
  version: string;
  configVersion: number;
  remoteName: string;
  displayName?: string;
  defaultFieldSchema?: SchemaNode;
  configSchema?: SchemaNode;
  configBindings?: Record<string, string>;
}
export interface Document {
  id: string; kind: 'form' | 'template' | 'config'; title: string; schema: SchemaNode;
  componentLocks: Record<string, ComponentLock>; bindings: Record<string, string>;
  revision: number; publishedVersion?: number; updatedAt?: string; createdAt?: string; sourceTemplateId?: string; sourceTemplateVersion?: number;
}
export interface Snapshot { id: string; title: string; version: number; schema: SchemaNode; componentLocks: Record<string, ComponentLock>; bindings: Record<string, string> }
export interface ComponentItem { componentName: string; version: string; manifest: { schemaComponent: string; displayName: string; kind: 'field' | 'container'; defaultFieldSchema: SchemaNode; allowedProps: string[] } }
export interface ActiveComponentItem {
  componentName: string;
  version: string;
  metadata?: { lowcode?: { displayName?: string } };
}

let csrf = '';
async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/lowcode${path}`, { method, credentials: 'same-origin', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(csrf ? { 'x-lowcode-csrf': csrf } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.code !== 0) throw new Error(result.msg || `请求失败 (${response.status})`);
  return result.data as T;
}
export const api = {
  async me() { const user = await call<User>('/auth/me'); csrf = user.csrf; return user; },
  async login(username: string, password: string) { const user = await call<User>('/auth/login', 'POST', { username, password }); csrf = user.csrf; return user; },
  async logout() { await call('/auth/logout', 'POST', {}); csrf = ''; },
  components: () => call<ComponentItem[]>('/components'),
  async activeComponents(): Promise<ActiveComponentItem[]> {
    const response = await fetch('/micro/config/active-components', { credentials: 'same-origin' });
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(result.msg || `请求失败 (${response.status})`);
    }
    const components = result.data as Record<string, Omit<ActiveComponentItem, 'componentName'>>;
    return Object.entries(components).map(([componentName, component]) => ({
      ...component,
      componentName,
    }));
  },
  publishedForms: () => call<{ id: string; title: string; version: number }[]>('/forms/published'),
  list: (kind: 'forms' | 'templates' | 'component-configs') => call<Document[]>(`/${kind}`),
  get: (kind: 'forms' | 'templates' | 'component-configs', id: string) => call<Document>(`/${kind}/${encodeURIComponent(id)}`),
  create: (kind: 'forms' | 'templates' | 'component-configs', data: unknown) => call<Document>(`/${kind}`, 'POST', data),
  save: (kind: 'forms' | 'templates' | 'component-configs', id: string, data: unknown) => call<Document>(`/${kind}/${encodeURIComponent(id)}`, 'PUT', data),
  publish: (kind: 'forms' | 'templates' | 'component-configs', id: string, revision: number) => call<{ version: number }>(`/${kind}/${encodeURIComponent(id)}/publish`, 'POST', { revision }),
  published: (kind: 'forms' | 'templates' | 'component-configs', id: string) => call<Snapshot>(`/${kind}/${encodeURIComponent(id)}/published`),
  versioned: (kind: 'templates' | 'component-configs', id: string, version: number) => call<Snapshot>(`/${kind}/${encodeURIComponent(id)}/versions/${version}`),
  submit: (id: string, publishVersion: number, values: Record<string, unknown>) => call<{ id: string; publishVersion: number }>(`/forms/${encodeURIComponent(id)}/submissions`, 'POST', { publishVersion, values }),
};
