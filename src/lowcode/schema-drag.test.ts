import { moveSchemaNode } from './schema-drag';
import { SchemaNode } from './api';

const createSchema = (): SchemaNode => ({
  type: 'object',
  properties: {
    first: { type: 'string', 'x-component': 'Input', title: '姓名' },
    card: {
      type: 'void',
      'x-component': 'Card',
      properties: {
        child: { type: 'string', 'x-component': 'Input' },
        nested: { type: 'void', 'x-component': 'Card', properties: {} },
      },
    },
    last: { type: 'string', 'x-component': 'Input' },
  },
});

test('sorts in both directions without mutating the original schema', () => {
  const schema = createSchema();
  const moved = moveSchemaNode(schema, 'first', { path: 'last', placement: 'after' })!;
  expect(Object.keys(moved.schema.properties!)).toEqual(['card', 'last', 'first']);
  expect(Object.keys(schema.properties!)).toEqual(['first', 'card', 'last']);
  const restored = moveSchemaNode(moved.schema, 'first', { path: 'card', placement: 'before' })!;
  expect(restored.schema).toEqual(schema);
});

test('moves fields into containers, sorts nested fields and moves them back to root', () => {
  const schema = createSchema();
  const inside = moveSchemaNode(schema, 'first', { path: 'card', placement: 'inside' })!;
  expect(inside.path).toBe('card.first');
  expect(inside.schema.properties!.card.properties!.first.title).toBe('姓名');
  expect(inside.schema.properties!.first).toBeUndefined();
  const sorted = moveSchemaNode(inside.schema, 'card.first', { path: 'card.child', placement: 'before' })!;
  expect(Object.keys(sorted.schema.properties!.card.properties!)).toEqual(['first', 'child', 'nested']);
  const outside = moveSchemaNode(sorted.schema, 'card.first', { path: '', placement: 'inside' })!;
  expect(outside.path).toBe('first');
  expect(outside.schema.properties!.first).toEqual(schema.properties!.first);
});

test('moves entire containers while rejecting self and descendant drops', () => {
  const schema = createSchema();
  expect(moveSchemaNode(schema, 'card', { path: 'card', placement: 'inside' })).toBeUndefined();
  expect(moveSchemaNode(schema, 'card', { path: 'card.nested', placement: 'inside' })).toBeUndefined();
  const moved = moveSchemaNode(schema, 'card', { path: 'last', placement: 'after' })!;
  expect(moved.schema.properties!.card).toEqual(schema.properties!.card);
});

test('rejects missing targets and conflicting field names', () => {
  const schema = createSchema();
  schema.properties!.card.properties!.first = { type: 'number' };
  expect(moveSchemaNode(schema, 'first', { path: 'card', placement: 'inside' })).toBeUndefined();
  expect(moveSchemaNode(schema, 'missing', { path: '', placement: 'inside' })).toBeUndefined();
  expect(moveSchemaNode(schema, 'first', { path: 'missing', placement: 'after' })).toBeUndefined();
});
