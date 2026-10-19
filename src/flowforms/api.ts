export interface FormMeta {
  formCode: string;
  title: string;
  placement: 'inline' | 'route';
  path?: string;
  updatedAt: number;
}

export interface StoredForm extends FormMeta {
  schema: Record<string, unknown>;
}

const isLocal = process.env.NODE_ENV === 'development';
const staticBase = `${process.env.PUBLIC_URL || ''}/flowforms`;
const apiBase = `${(process.env.REACT_APP_EXPRESS_API_URL || 'http://127.0.0.1:1001').replace(/\/$/, '')}/api/forms`;

async function fetchJson<T>(url: string, envelope = false): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 404 ? '表单不存在' : '读取表单失败');
  const body = await response.text();
  let parsed: any;
  try { parsed = JSON.parse(body); }
  catch { throw new Error(body.trimStart().startsWith('<') ? '表单不存在' : '表单文件格式错误'); }
  if (envelope) {
    if (parsed.code !== 0) throw new Error(parsed.msg || '读取表单失败');
    return parsed.data as T;
  }
  return parsed as T;
}

export const listForms = (source: 'default' | 'express' = 'default') => source === 'express' || !isLocal
  ? fetchJson<FormMeta[]>(apiBase, true)
  : fetchJson<FormMeta[]>(`${staticBase}/index.json`);
export const getForm = (formCode: string, source: 'default' | 'express' = 'default') => source === 'express' || !isLocal
  ? fetchJson<StoredForm>(`${apiBase}/${encodeURIComponent(formCode)}`, true)
  : fetchJson<StoredForm>(`${staticBase}/${encodeURIComponent(formCode)}.json`);
