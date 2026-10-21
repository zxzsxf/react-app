import { api, ComponentLock, Document } from '../lowcode/api';
import { withComponentConfigs } from '../lowcode/template-schema';
import { supportedComponents, validateDraft } from './draft';
import { AIFormDraft, clone, StartingPoint } from './types';

export interface BlankCatalog {
  locks: Record<string, ComponentLock>;
  warnings: string[];
}

export const loadBlankCatalog = async (): Promise<BlankCatalog> => {
  const [active, published] = await Promise.all([api.activeComponents(), api.components()]);
  const available = published.filter((item) =>
    supportedComponents.includes(item.manifest.schemaComponent) &&
    active.some((entry) => entry.componentName === item.componentName && entry.version === item.version),
  );
  const results = await Promise.allSettled(available.map(async (item) => {
    const config = await api.published('component-configs', `${item.componentName}:${item.version}`);
    if (!Number.isInteger(config.version) || config.version < 1) {
      throw new Error('尚无已发布配置');
    }
    const lock: ComponentLock = {
      remoteName: item.componentName,
      version: item.version,
      configVersion: config.version,
      kind: item.manifest.kind,
      displayName: item.manifest.displayName,
      defaultFieldSchema: clone(item.manifest.defaultFieldSchema),
    };
    return { name: item.manifest.schemaComponent, lock };
  }));
  const locks: Record<string, ComponentLock> = {};
  const warnings: string[] = [];
  results.forEach((result, index) => {
    const name = available[index].manifest.schemaComponent;
    if (result.status === 'fulfilled') {
      if (locks[name]) {
        warnings.push(`${name} 存在多个活跃实现，保留目录中的第一个版本`);
      } else {
        locks[name] = result.value.lock;
      }
    } else {
      const reason = result.reason as Error & { status?: number };
      if (reason.status === 401 || reason.status === 403) {
        throw reason;
      }
      const message = reason.status === 404
        ? '未找到已发布配置，请先创建并发布该版本的配置表单'
        : reason.message || '读取已发布配置失败';
      warnings.push(`${name} 不可用：${message}`);
    }
  });
  if (!locks.Input) {
    warnings.push('没有可用 Input，请先发布并启用 Input 组件及其配置表单，或选择已发布模板');
  }
  return { locks, warnings };
};

export const loadTemplates = async (): Promise<Document[]> =>
  (await api.list('templates')).filter((item) => Boolean(item.publishedVersion));

export const loadStartingDraft = async (
  point: StartingPoint,
  catalog: BlankCatalog,
): Promise<AIFormDraft> => {
  if (point.mode === 'blank') {
    return {
      title: '新表单',
      schema: { type: 'object', properties: {} },
      componentLocks: clone(catalog.locks),
    };
  }
  if (!point.templateId) {
    throw new Error('请选择已发布模板');
  }
  const snapshot = await api.published('templates', point.templateId);
  const draft: AIFormDraft = clone({
    title: `${snapshot.title}副本`,
    schema: snapshot.schema,
    componentLocks: snapshot.componentLocks,
  });
  draft.schema = withComponentConfigs(draft.schema, draft.componentLocks);
  validateDraft(draft);
  return draft;
};
