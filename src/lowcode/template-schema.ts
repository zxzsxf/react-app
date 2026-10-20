import { ComponentLock, SchemaNode } from './api';

export const withComponentConfigs = (
  schema: SchemaNode,
  locks: Record<string, ComponentLock>,
): SchemaNode => ({
  ...schema,
  'x-component-configs': Object.fromEntries(
    Object.entries(locks)
      .filter(([, lock]) => Boolean(lock.configSchema))
      .map(([name, lock]) => [name, {
        schema: lock.configSchema!,
        bindings: lock.configBindings || {},
      }]),
  ),
});
