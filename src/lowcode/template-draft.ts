import { Document } from './api';

const draftKey = (id: string) => `lowcode:template-draft:${id}`;

export const storeTemplateDraft = (id: string, title: string) => {
  const draft: Document = {
    id: `template:${id}`,
    kind: 'template',
    title,
    schema: { type: 'object', properties: {} },
    componentLocks: {},
    bindings: {},
    revision: 0,
  };
  sessionStorage.setItem(draftKey(id), JSON.stringify(draft));
};

export const readTemplateDraft = (id: string): Document | null => {
  const value = sessionStorage.getItem(draftKey(id));
  return value ? JSON.parse(value) : null;
};

export const removeTemplateDraft = (id: string) => {
  sessionStorage.removeItem(draftKey(id));
};
