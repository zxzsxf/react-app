import { SchemaNode } from './api';

export type DropPlacement = 'before' | 'after' | 'inside';
export interface SchemaDropTarget {
  path: string;
  placement: DropPlacement;
}

export const orderedProperties = (node: SchemaNode): [string, SchemaNode][] =>
  Object.entries(node.properties || {}).sort(
    ([, first], [, second]) => (first['x-index'] ?? Infinity) - (second['x-index'] ?? Infinity),
  );

export const setPropertyOrder = (node: SchemaNode, entries: [string, SchemaNode][]) => {
  if (entries.some(([, child]) => child['x-index'] !== undefined)) {
    entries.forEach(([, child], index) => {
      child['x-index'] = index;
    });
  }
  node.properties = Object.fromEntries(entries);
};

export const schemaNodeAt = (schema: SchemaNode, path: string): SchemaNode | undefined =>
  path.split('.').filter(Boolean).reduce<SchemaNode | undefined>(
    (node, key) => node?.properties?.[key],
    schema,
  );

export const moveSchemaNode = (
  schema: SchemaNode,
  source: string,
  target: SchemaDropTarget,
): { schema: SchemaNode; path: string } | undefined => {
  if (!source || target.path === source || target.path.startsWith(`${source}.`)) {
    return;
  }
  const next: SchemaNode = JSON.parse(JSON.stringify(schema));
  const node = schemaNodeAt(next, source);
  const sourceParts = source.split('.');
  const key = sourceParts.pop()!;
  const sourceParent = schemaNodeAt(next, sourceParts.join('.'));
  const targetParts = target.path.split('.').filter(Boolean);
  const anchor = target.placement === 'inside' ? undefined : targetParts.pop();
  const parentPath = targetParts.join('.');
  const parent = schemaNodeAt(next, parentPath);
  if (!node || !sourceParent || !parent || (anchor && !parent.properties?.[anchor])) {
    return;
  }
  // 保留字段名，避免跨容器移动时覆盖同名字段。
  if (parent !== sourceParent && parent.properties?.[key]) {
    return;
  }
  delete sourceParent.properties?.[key];
  const entries = orderedProperties(parent);
  const index = anchor
    ? entries.findIndex(([name]) => name === anchor) + (target.placement === 'after' ? 1 : 0)
    : entries.length;
  entries.splice(index, 0, [key, node]);
  if (parent !== sourceParent) {
    setPropertyOrder(sourceParent, orderedProperties(sourceParent));
  }
  setPropertyOrder(parent, entries);
  return { schema: next, path: parentPath ? `${parentPath}.${key}` : key };
};
