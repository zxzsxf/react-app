export const formCodePattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
export const formRoutePattern = /^\/forms\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*$/;

interface EditorTarget {
  formCode: string;
  title: string;
  placement: 'inline' | 'route';
  path?: string;
}

export const openFormEditor = (target: EditorTarget) => {
  const base = process.env.REACT_APP_FLOWFORM_EDITOR_URL || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:6575/editor' : '');
  if (!base) throw new Error('未配置线上表单编辑器地址');
  const url = new URL(base);
  url.searchParams.set('flowformMode', 'project');
  url.searchParams.set('formCode', target.formCode);
  url.searchParams.set('title', target.title);
  url.searchParams.set('placement', target.placement);
  if (target.path) url.searchParams.set('path', target.path);
  url.searchParams.set('returnTo', window.location.href);
  window.location.assign(url.toString());
};
