// Keep this wire contract in sync with flowform-editor/src/manage/protocol.ts.
export const MANAGE_CHANNEL = 'flowform-manage';
export const MANAGE_VERSION = 1;

export interface ManageSchema {
  type: string;
  properties?: Record<string, ManageSchema>;
}

export type ManageMessage = {
  channel: typeof MANAGE_CHANNEL;
  version: typeof MANAGE_VERSION;
  sessionId: string;
  requestId: string;
} & (
  | { type: 'connect' | 'ready' | 'initialized' | 'read-schema' | 'save' }
  | { type: 'initialize' | 'schema'; schema: ManageSchema }
  | { type: 'error'; message: string }
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isManageSchema = (value: unknown): value is ManageSchema => {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.properties === undefined) return true;
  return isRecord(value.properties) && Object.values(value.properties).every(isManageSchema);
};

export const isManageMessage = (value: unknown): value is ManageMessage => {
  if (
    !isRecord(value) ||
    value.channel !== MANAGE_CHANNEL ||
    value.version !== MANAGE_VERSION ||
    typeof value.sessionId !== 'string' ||
    !value.sessionId ||
    typeof value.requestId !== 'string' ||
    !value.requestId
  )
    return false;

  switch (value.type) {
    case 'connect':
    case 'ready':
    case 'initialized':
    case 'read-schema':
    case 'save':
      return true;
    case 'initialize':
    case 'schema':
      return isManageSchema(value.schema) && value.schema.type === 'object';
    case 'error':
      return typeof value.message === 'string';
    default:
      return false;
  }
};
