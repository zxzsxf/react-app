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

const base = `${process.env.PUBLIC_URL || ''}/flowforms`;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 404 ? '表单不存在' : '读取表单失败');
  const body = await response.text();
  try { return JSON.parse(body) as T; }
  catch { throw new Error(body.trimStart().startsWith('<') ? '表单不存在' : '表单文件格式错误'); }
}

export const listForms = () => fetchJson<FormMeta[]>(`${base}/index.json`);
export const getForm = (formCode: string) => fetchJson<StoredForm>(`${base}/${encodeURIComponent(formCode)}.json`);
