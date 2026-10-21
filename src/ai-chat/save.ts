import { api, ApiError } from '../lowcode/api';
import { prepareDraft, validateDraft } from './draft';
import { AIFormDraft, clone } from './types';

export interface SaveAttempt {
  id: string;
  draft: AIFormDraft;
  attempted: boolean;
}

export const createSaveAttempt = (draft: AIFormDraft): SaveAttempt => {
  validateDraft(draft);
  return {
    id: `f${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
    draft: prepareDraft(draft),
    attempted: false,
  };
};

export const saveNewDraft = async (attempt: SaveAttempt): Promise<string> => {
  if (attempt.attempted) {
    try {
      await api.get('forms', attempt.id);
      // 此 ID 由当前会话分配；上次 POST 可能已成功但响应丢失。
      return attempt.id;
    } catch (cause) {
      if (!(cause instanceof ApiError) || cause.status !== 404) {
        throw cause;
      }
    }
  }
  attempt.attempted = true;
  const draft = clone(attempt.draft);
  try {
    await api.create('forms', {
      id: attempt.id,
      ...draft,
      bindings: {},
    });
  } catch (cause) {
    if (cause instanceof ApiError && [400, 401, 403, 422].includes(cause.status)) {
      attempt.attempted = false;
    }
    throw cause;
  }
  return attempt.id;
};
