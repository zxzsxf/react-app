import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Input, Space, Typography } from 'antd';
import { AppstoreOutlined, EditOutlined, EyeOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import {
  api,
  ComponentItem,
  Document,
  SchemaNode,
  Snapshot,
} from '../lowcode/api';
import { LowCodeRenderer } from '../lowcode/MobileRenderer';
import {
  moveSchemaNode,
  orderedProperties,
  SchemaDropTarget,
  setPropertyOrder,
} from '../lowcode/schema-drag';
import { createForm, onFieldInputValueChange } from '@formily/core';
import { createSchemaField } from '@formily/react';
import {
  Form as SchemaForm,
  FormItem,
  Input as SchemaInput,
  Switch,
} from '@formily/antd';
import '@formily/antd/dist/antd.css';
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
  if (!node) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="点击画布中的组件进行配置" />;
  if (!config) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该组件暂无配置表单" />;
  return (
    <SchemaForm
      form={form}
      layout="horizontal"
      labelWidth={80}
      labelAlign="right"
      colon
    >
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
  const [previewing, setPreviewing] = useState(false);
  const [config, setConfig] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const draggedPath = useRef('');
  const [dropTarget, setDropTarget] = useState<SchemaDropTarget | null>(null);
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
  const selectedNode = doc && selected ? nodeAt(doc.schema, selected) : undefined;
  const selectedLock = selectedNode
    ? doc?.componentLocks[selectedNode['x-component'] || '']
    : undefined;
  useEffect(() => {
    let active = true;
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
        .then((value) => {
          if (active) setConfig(value);
        })
        .catch((cause) => {
          if (active) setError(cause.message);
        });
    return () => {
      active = false;
    };
  }, [selectedLock]);
  const change = (mutate: (schema: SchemaNode) => void) => {
    if (!doc) return;
    const schema = clone(doc.schema);
    mutate(schema);
    setDoc({ ...doc, schema });
  };
  const isContainer = (node?: SchemaNode) => {
    const name = node?.['x-component'];
    if (!name) return false;
    const kind = doc?.componentLocks[name]?.kind ||
      (template?.catalog || catalog).find(
        (item) => item.manifest.schemaComponent === name,
      )?.manifest.kind;
    return kind === 'container' || name === 'Card' || Boolean(node?.properties);
  };
  const add = async (item: ComponentItem, destination?: SchemaDropTarget) => {
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
          kind: item.manifest.kind,
        };
      }
      const schema = clone(doc.schema);
      const parentPath = destination
        ? destination.placement === 'inside'
          ? destination.path
          : parts(destination.path).slice(0, -1).join('.')
        : isContainer(selectedNode) ? selected : '';
      const target = nodeAt(schema, parentPath);
      if (!target) return;
      target.properties = target.properties || {};
      const key = `${name.toLowerCase()}_${crypto
        .randomUUID()
        .replace(/-/g, '')
        .slice(0, 6)}`;
      target.properties[key] = clone(item.manifest.defaultFieldSchema);
      if (destination && destination.placement !== 'inside') {
        const entries = orderedProperties(target).filter(([name]) => name !== key);
        const anchor = parts(destination.path).slice(-1)[0];
        const index = entries.findIndex(([name]) => name === anchor) +
          (destination.placement === 'after' ? 1 : 0);
        entries.splice(index, 0, [key, target.properties[key]]);
        setPropertyOrder(target, entries);
      }
      setDoc({ ...doc, schema, componentLocks: locks });
      setSelected(parentPath ? `${parentPath}.${key}` : key);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const remove = (path: string) =>
    change((schema) => {
      const parent = parentAt(schema, path);
      delete parent.properties?.[parts(path).slice(-1)[0]];
      if (selected === path || selected.startsWith(`${path}.`)) {
        setSelected('');
      }
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
            kind: lock.kind || (name === 'Card' ? 'container' : 'field'),
            defaultFieldSchema: lock.defaultFieldSchema || {
              type: name === 'Input' ? 'string' : 'void',
              'x-component': name,
            },
            allowedProps: [],
          },
        }))
      : undefined;
  const availableCatalog = template?.catalog || bundledCatalog || catalog;
  const getDropTarget = (event: React.DragEvent): SchemaDropTarget => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-lowcode-path]');
    const path = element?.dataset.lowcodePath;
    if (!element || !path) return { path: '', placement: 'inside' };
    const rect = element.getBoundingClientRect();
    const ratio = rect.height ? (event.clientY - rect.top) / rect.height : 0.5;
    const container = isContainer(nodeAt(doc!.schema, path));
    return {
      path,
      placement: container && ratio >= 0.2 && ratio <= 0.8
        ? 'inside'
        : ratio < 0.5 ? 'before' : 'after',
    };
  };
  const canDrop = (target: SchemaDropTarget) => {
    const source = draggedPath.current;
    return !source || Boolean(moveSchemaNode(doc!.schema, source, target));
  };
  const clearDrag = () => {
    draggedPath.current = '';
    setDropTarget(null);
  };
  const select = useCallback((path: string) => setSelected(path), []);
  if (!doc) return <div>{error || '加载表单中...'}</div>;
  return (
    <div className="lowcode-builder-page">
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
        <aside className="lowcode-palette">
          <div className="lowcode-panel-heading">
            <AppstoreOutlined />
            <Typography.Title level={5}>组件库</Typography.Title>
          </div>
          <p className="lowcode-panel-description">点击或拖拽组件，搭建你的表单</p>
          <div className="lowcode-palette-items">
          {availableCatalog
            .filter(
              (item) =>
                !template ||
                Boolean(doc.componentLocks[item.manifest.schemaComponent]),
            )
            .map((item) => (
              <Button
                block
                className="lowcode-palette-item"
                key={`${item.componentName}:${item.version}`}
                draggable={!previewing}
                disabled={previewing}
                onDragStart={(event) => {
                  draggedPath.current = '';
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData(
                    'text/plain',
                    `${item.componentName}:${item.version}`,
                  );
                }}
                onDragEnd={clearDrag}
                onClick={() => add(item)}
              >
                <span className="lowcode-palette-icon"><AppstoreOutlined /></span>
                <span>{item.manifest.displayName}</span>
                <PlusOutlined className="lowcode-palette-add" />
              </Button>
            ))}
          </div>
        </aside>
        <section className="lowcode-canvas">
          <div className="lowcode-canvas-toolbar">
            <div>
              <strong>{previewing ? '表单预览' : '表单画布'}</strong>
              <span>{previewing ? '体验实际填写效果' : '拖拽排序，拖到容器中间放入容器'}</span>
            </div>
            <Button
              icon={previewing ? <EditOutlined /> : <EyeOutlined />}
              type={previewing ? 'primary' : 'default'}
              onClick={() => {
                clearDrag();
                setPreviewing(!previewing);
              }}
            >
              {previewing ? '返回编辑' : '预览'}
            </Button>
          </div>
          <div
            className={`lowcode-phone${dropTarget?.path === '' ? ' is-drop-root' : ''}`}
            onDragStart={(event) => {
              if (previewing) return;
              const element = (event.target as HTMLElement).closest<HTMLElement>('[data-lowcode-path]');
              if (!element?.dataset.lowcodePath) return;
              draggedPath.current = element.dataset.lowcodePath;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('application/x-lowcode-node', draggedPath.current);
            }}
            onDragEnd={clearDrag}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropTarget(null);
              }
            }}
            onDragOver={(event) => {
              if (previewing) return;
              const target = getDropTarget(event);
              if (!canDrop(target)) {
                event.dataTransfer.dropEffect = 'none';
                setDropTarget(null);
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = draggedPath.current ? 'move' : 'copy';
              setDropTarget(target);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (previewing) return;
              const target = getDropTarget(event);
              const source = draggedPath.current;
              clearDrag();
              if (source) {
                const result = moveSchemaNode(doc.schema, source, target);
                if (result) {
                  setDoc({ ...doc, schema: result.schema });
                  setSelected(result.path);
                }
                return;
              }
              const value = event.dataTransfer.getData('text/plain');
              const item = availableCatalog.find(
                (candidate) =>
                  `${candidate.componentName}:${candidate.version}` === value,
              );
              if (
                item &&
                (!template || doc.componentLocks[item.manifest.schemaComponent])
              )
                add(item, target);
            }}
          >
            <div className="lowcode-phone-status" aria-hidden="true">
              <span>9:41</span>
              <span className="lowcode-phone-camera" />
              <span>••• ▰</span>
            </div>
            <div className="lowcode-phone-screen">
              <h3>{doc.title}</h3>
              <LowCodeRenderer
                key={previewing ? 'preview' : 'editor'}
                schema={doc.schema}
                locks={doc.componentLocks}
                onSelect={previewing ? undefined : select}
                selectedPath={selected}
                onRemove={previewing ? undefined : remove}
                draggable={!previewing}
                dropTarget={dropTarget}
              />
            </div>
            <div className="lowcode-phone-home" aria-hidden="true" />
          </div>
        </section>
        <aside className="lowcode-config">
          <div className="lowcode-panel-heading">
            <SettingOutlined />
            <Typography.Title level={5}>组件配置</Typography.Title>
          </div>
          <p className="lowcode-panel-description">配置所选组件的展示内容与属性</p>
          {selectedNode && (
            <div className="lowcode-config-selection">
              <AppstoreOutlined />
              <span>{selectedLock?.displayName || selectedNode['x-component']}</span>
            </div>
          )}
          <div className="lowcode-config-form">
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
          </div>
        </aside>
      </div>
    </div>
  );
};
export default LowCodeFormBuilderPage;
