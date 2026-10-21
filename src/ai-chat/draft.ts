import { SchemaNode } from '../lowcode/api';
import { withComponentConfigs } from '../lowcode/template-schema';
import { AIFormDraft, clone } from './types';

export const supportedComponents = ['Input', 'Card', 'Button'];
const allowedProps: Record<string, string[]> = {
  Input: ['placeholder', 'disabled'],
  Card: ['title'],
  Button: ['label'],
};

export interface DraftField {
  key: string;
  node: SchemaNode;
  parent: SchemaNode;
}

export const fields = (schema: SchemaNode): DraftField[] =>
  Object.entries(schema.properties || {}).flatMap(([key, node]) => [
    { key, node, parent: schema },
    ...fields(node),
  ]);

// 可用但尚未使用的组件保留在候选目录中；提交时去掉无内置配置的闲置锁。
export const prepareDraft = (draft: AIFormDraft): AIFormDraft => {
  const used = new Set([
    draft.schema['x-component'],
    ...fields(draft.schema).map(({ node }) => node['x-component']),
  ]);
  const componentLocks = Object.fromEntries(
    Object.entries(draft.componentLocks).filter(
      ([name, lock]) => used.has(name) || Boolean(lock.configSchema),
    ),
  );
  return {
    title: draft.title.trim(),
    schema: withComponentConfigs(clone(draft.schema), componentLocks),
    componentLocks: clone(componentLocks),
  };
};

export const validateDraft = (draft: AIFormDraft) => {
  if (!draft.title.trim() || draft.title.trim().length > 160) {
    throw new Error('请填写 1～160 字的表单名称');
  }
  const schema = draft.schema;
  if (schema?.type !== 'object' || !schema.properties || Array.isArray(schema.properties)) {
    throw new Error('表单结构无效，请重新生成');
  }
  const visit = (node: SchemaNode, depth: number) => {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 12) {
      throw new Error('表单结构无效或嵌套过深');
    }
    const name = node['x-component'];
    if (name) {
      const lock = draft.componentLocks[name];
      if (!supportedComponents.includes(name) || !lock?.remoteName || !lock.version) {
        throw new Error(`缺少可用组件或版本：${name}`);
      }
      if (!lock.configSchema && (!Number.isInteger(lock.configVersion) || lock.configVersion < 1)) {
        throw new Error(`组件 ${name} 缺少已发布配置版本`);
      }
      if (Object.keys(node['x-component-props'] || {}).some(
        (key) => !allowedProps[name].includes(key),
      )) {
        throw new Error(`组件 ${name} 包含暂不支持的属性`);
      }
    }
    if (node.properties) {
      if (typeof node.properties !== 'object' || Array.isArray(node.properties)) {
        throw new Error('表单字段结构无效');
      }
      Object.values(node.properties).forEach((child) => visit(child, depth + 1));
    }
  };
  visit(schema, 0);
  const serialized = JSON.stringify({ schema, locks: draft.componentLocks });
  if (serialized.length > 256 * 1024) {
    throw new Error('表单配置过大');
  }
  JSON.parse(serialized, (key, value) => {
    const nonemptyRule = ['x-validator', 'x-reactions'].includes(key) && value !== null &&
      value !== '' && !(typeof value === 'object' && Object.keys(value).length === 0);
    if (['x-data', 'script'].includes(key) || /^on[A-Z]/.test(key) || nonemptyRule ||
      (typeof value === 'string' && value.includes('{{'))) {
      throw new Error('首期不支持脚本、表达式或字段联动配置');
    }
    return value;
  });
};
