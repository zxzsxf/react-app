import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Space, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import {
  api,
  ComponentItem,
  Document,
  SchemaNode,
  Snapshot,
} from '../lowcode/api';
import { LowCodeRenderer } from '../lowcode/MobileRenderer';
import { createForm, onFieldInputValueChange } from '@formily/core';
import { createSchemaField } from '@formily/react';
import {
  Form as SchemaForm,
  FormItem,
  Input as SchemaInput,
  Switch,
} from '@formily/antd';
import './LowCodeFormBuilderPage.css';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const parts = (path: string) => path.split('.').filter(Boolean);
const nodeAt = (schema: SchemaNode, path: string): SchemaNode | undefined =>
  parts(path).reduce<SchemaNode | undefined>(
    (node, part) => node?.properties?.[part],
    schema,
  );
const parentAt = (schema: SchemaNode, path: string) =>
  nodeAt(schema, parts(path).slice(0, -1).join('.')) || schema;
const enumerate = (
  schema: SchemaNode,
  prefix = '',
): { path: string; node: SchemaNode }[] =>
  Object.entries(schema.properties || {}).flatMap(([key, node]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [{ path, node }, ...enumerate(node, path)];
  });
const readPath = (node: SchemaNode, path: string): any =>
  path.startsWith('x-component-props.')
    ? node['x-component-props']?.[path.split('.')[1]]
    : (node as any)[path];
const writePath = (node: SchemaNode, path: string, value: any) => {
  if (path.startsWith('x-component-props.'))
    node['x-component-props'] = {
      ...node['x-component-props'],
      [path.split('.')[1]]: value,
    };
  else (node as any)[path] = value;
};

const ConfigFields = createSchemaField({
  components: { Input: SchemaInput, Switch, FormItem },
});

const PropertyPanel: React.FC<{
  node: SchemaNode | undefined;
  config: Snapshot | null;
  onChange: (path: string, value: any) => void;
}> = ({ node, config, onChange }) => {
  const changeRef = React.useRef(onChange);
  changeRef.current = onChange;
  const form = useMemo(
    () =>
      createForm({
        effects() {
          onFieldInputValueChange('*', (field) => {
            const path = config?.bindings[field.path.toString()];
            if (path) changeRef.current(path, field.value);
          });
        },
      }),
    [config],
  );
  useEffect(() => {
    form.setValues(
      Object.fromEntries(
        Object.entries(config?.bindings || {}).map(([field, path]) => [
          field,
          node ? readPath(node, path) : undefined,
        ]),
      ),
      'overwrite',
    );
  }, [node, config, form]);
  if (!node) return <div>在手机画布中选择组件</div>;
  if (!config) return <div>该版本尚无组件配置表单</div>;
  return (
    <SchemaForm form={form} layout="vertical">
      <ConfigFields schema={config.schema as any} />
    </SchemaForm>
  );
};

export interface TemplateBuilderProps {
  document: Document;
  catalog: ComponentItem[];
  onChange: (document: Document) => void;
}

const LowCodeFormBuilderPage: React.FC<{ template?: TemplateBuilderProps }> = ({
  template,
}) => {
  const { formCode = '' } = useParams();
  const [storedDoc, setStoredDoc] = useState<Document | null>(null);
  const doc = template?.document || storedDoc;
  const setDoc = (value: Document) => {
    if (template) template.onChange(value);
    else setStoredDoc(value);
  };
  const [catalog, setCatalog] = useState<ComponentItem[]>([]);
  const [selected, setSelected] = useState('');
  const [config, setConfig] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (template) return;
    api
      .get('forms', formCode)
      .then(setStoredDoc)
      .catch((cause) => setError(cause.message));
    api
      .components()
      .then(setCatalog)
      .catch((cause) => setError(cause.message));
  }, [formCode, template]);
  const selectedNode = doc ? nodeAt(doc.schema, selected) : undefined;
  const selectedLock = selectedNode
    ? doc?.componentLocks[selectedNode['x-component'] || '']
    : undefined;
  useEffect(() => {
    setConfig(null);
    if (selectedLock?.configSchema) {
      setConfig({
        id: selectedLock.remoteName,
        title: '',
        version: 0,
        schema: selectedLock.configSchema,
        bindings: selectedLock.configBindings || {},
        componentLocks: {},
      });
      return;
    }
    if (selectedLock)
      api
        .versioned(
          'component-configs',
          `${selectedLock.remoteName}:${selectedLock.version}`,
          selectedLock.configVersion,
        )
        .then(setConfig)
        .catch((cause) => setError(cause.message));
  }, [selectedLock]);
  const change = (mutate: (schema: SchemaNode) => void) => {
    if (!doc) return;
    const schema = clone(doc.schema);
    mutate(schema);
    setDoc({ ...doc, schema });
    setMessage('未保存');
  };
  const add = async (item: ComponentItem) => {
    if (!doc) return;
    setError('');
    try {
      const name = item.manifest.schemaComponent;
      const locks = { ...doc.componentLocks };
      if (locks[name] && locks[name].version !== item.version)
        throw new Error(
          `${name} 已锁定 ${locks[name].version}，同一表单暂不混用不同版本`,
        );
      if (!locks[name]) {
        const published = await api.published(
          'component-configs',
          `${item.componentName}:${item.version}`,
        );
        locks[name] = {
          version: item.version,
          remoteName: item.componentName,
          configVersion: published.version,
        };
      }
      const schema = clone(doc.schema);
      const target =
        selectedNode?.['x-component'] === 'Card'
          ? nodeAt(schema, selected)
          : schema;
      if (!target) return;
      target.properties = target.properties || {};
      const key = `${name.toLowerCase()}_${crypto
        .randomUUID()
        .replace(/-/g, '')
        .slice(0, 6)}`;
      target.properties[key] = clone(item.manifest.defaultFieldSchema);
      setDoc({ ...doc, schema, componentLocks: locks });
      setSelected(
        selectedNode?.['x-component'] === 'Card' ? `${selected}.${key}` : key,
      );
      setMessage('未保存');
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const remove = () =>
    change((schema) => {
      const parent = parentAt(schema, selected);
      delete parent.properties?.[parts(selected).slice(-1)[0]];
      setSelected('');
    });
  const move = (offset: number) =>
    change((schema) => {
      const parent = parentAt(schema, selected);
      const entries = Object.entries(parent.properties || {});
      const index = entries.findIndex(
        ([key]) => key === parts(selected).slice(-1)[0],
      );
      const next = index + offset;
      if (index < 0 || next < 0 || next >= entries.length) return;
      [entries[index], entries[next]] = [entries[next], entries[index]];
      parent.properties = Object.fromEntries(entries);
    });
  const save = async (publish = false) => {
    if (!doc) return;
    setError('');
    setMessage('');
    try {
      const used = new Set(
        enumerate(doc.schema)
          .map((item) => item.node['x-component'])
          .filter(Boolean),
      );
      const locks = Object.fromEntries(
        Object.entries(doc.componentLocks).filter(
          ([key, lock]) => used.has(key) || Boolean(lock.configSchema),
        ),
      );
      const updated = await api.save('forms', formCode, {
        revision: doc.revision,
        title: doc.title,
        schema: doc.schema,
        componentLocks: locks,
      });
      setDoc(updated);
      if (publish) {
        const result = await api.publish('forms', formCode, updated.revision);
        setDoc({ ...updated, publishedVersion: result.version });
        setMessage(`已发布 v${result.version}`);
      } else setMessage('草稿已保存');
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const bundledCatalog: ComponentItem[] | undefined =
    doc && Object.values(doc.componentLocks).some((lock) => lock.configSchema)
      ? Object.entries(doc.componentLocks).map(([name, lock]) => ({
          componentName: lock.remoteName,
          version: lock.version,
          manifest: {
            schemaComponent: name,
            displayName: lock.displayName || name,
            kind: name === 'Card' ? 'container' : 'field',
            defaultFieldSchema: lock.defaultFieldSchema || {
              type: name === 'Input' ? 'string' : 'void',
              'x-component': name,
            },
            allowedProps: [],
          },
        }))
      : undefined;
  const availableCatalog = template?.catalog || bundledCatalog || catalog;
  const select = useCallback((path: string) => setSelected(path), []);
  const rows = useMemo(() => (doc ? enumerate(doc.schema) : []), [doc]);
  if (!doc) return <div>{error || '加载表单中...'}</div>;
  return (
    <div>
      {!template && (
        <Space style={{ marginBottom: 12 }}>
          <Input
            value={doc.title}
            onChange={(event) => setDoc({ ...doc, title: event.target.value })}
            style={{ width: 220 }}
          />
          <Button onClick={() => save(false)}>保存草稿</Button>
          <Button type="primary" onClick={() => save(true)}>
            发布
          </Button>
          <span>
            {doc.publishedVersion
              ? `已发布 v${doc.publishedVersion}`
              : '未发布'}
          </span>
        </Space>
      )}
      {error && (
        <Alert type="error" message={error} style={{ marginBottom: 12 }} />
      )}
      {message && (
        <Alert type="info" message={message} style={{ marginBottom: 12 }} />
      )}
      <div className="lowcode-builder">
        <aside>
          <Typography.Title level={5}>组件</Typography.Title>
          {availableCatalog
            .filter(
              (item) =>
                !template ||
                Boolean(doc.componentLocks[item.manifest.schemaComponent]),
            )
            .map((item) => (
              <Button
                block
                key={`${item.componentName}:${item.version}`}
                draggable
                onDragStart={(event) =>
                  event.dataTransfer.setData(
                    'text/plain',
                    `${item.componentName}:${item.version}`,
                  )
                }
                onClick={() => add(item)}
                style={{ marginBottom: 8 }}
              >
                {item.manifest.displayName} · {item.version}
              </Button>
            ))}
        </aside>
        <div
          className="lowcode-phone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const value = event.dataTransfer.getData('text/plain');
            const item = availableCatalog.find(
              (candidate) =>
                `${candidate.componentName}:${candidate.version}` === value,
            );
            if (
              item &&
              (!template || doc.componentLocks[item.manifest.schemaComponent])
            )
              add(item);
          }}
        >
          <div className="lowcode-phone-screen">
            <h3>{doc.title}</h3>
            <LowCodeRenderer
              schema={doc.schema}
              locks={doc.componentLocks}
              onSelect={select}
            />
          </div>
          <div className="lowcode-node-list">
            {rows.map(({ path, node }) => (
              <Button
                key={path}
                type={path === selected ? 'primary' : 'default'}
                size="small"
                onClick={() => setSelected(path)}
              >
                {path} · {node.title || node['x-component']}
              </Button>
            ))}
          </div>
        </div>
        <aside>
          <Typography.Title level={5}>属性配置</Typography.Title>
          {selectedNode && (
            <Space style={{ marginBottom: 12 }}>
              <Button size="small" onClick={() => move(-1)}>
                上移
              </Button>
              <Button size="small" onClick={() => move(1)}>
                下移
              </Button>
              <Button size="small" danger onClick={remove}>
                删除
              </Button>
            </Space>
          )}
          <PropertyPanel
            key={selected}
            node={selectedNode}
            config={config}
            onChange={(path, value) =>
              change((schema) => {
                const node = nodeAt(schema, selected);
                if (node) writePath(node, path, value);
              })
            }
          />
        </aside>
      </div>
    </div>
  );
};
export default LowCodeFormBuilderPage;
