import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Select, Space, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import { api, ComponentItem, ComponentLock, Document, SchemaNode } from '../../lowcode/api';
import { FlowformManageEditor, FlowformManageEditorHandle } from '../../lowcode/FlowformManageEditor';
import { readTemplateDraft, removeTemplateDraft } from '../../lowcode/template-draft';

type Kind = 'templates' | 'component-configs';

const inputTargets = [
  'title',
  'required',
  'x-component-props.placeholder',
  'x-component-props.disabled',
];
const cardTargets = ['title', 'x-component-props.title'];

const usedComponents = (node: SchemaNode, found = new Set<string>()): Set<string> => {
  const component = node['x-component'];
  if (component && ['Input', 'Card'].includes(component)) found.add(component);
  Object.values(node.properties || {}).forEach((child) => usedComponents(child, found));
  return found;
};

const clean = (node: SchemaNode): SchemaNode => {
  const next: SchemaNode = { type: node.type || 'string' };
  if (node.title) next.title = node.title;
  if (node.required) next.required = node.required;
  if (node['x-component']) next['x-component'] = node['x-component'];
  if (node['x-decorator']) next['x-decorator'] = node['x-decorator'];
  const props = node['x-component-props'] || {};
  const allowed =
    node['x-component'] === 'Input'
      ? ['placeholder', 'disabled']
      : node['x-component'] === 'Card'
      ? ['title']
      : [];
  const kept = Object.fromEntries(Object.entries(props).filter(([key]) => allowed.includes(key)));
  if (Object.keys(kept).length) next['x-component-props'] = kept;
  if (node.properties) {
    next.properties = Object.fromEntries(
      Object.entries(node.properties).map(([key, child]) => [key, clean(child)]),
    );
  }
  return next;
};

const ManageEditor: React.FC<{ kind: Kind; id: string }> = ({ kind, id }) => {
  const [draft] = useState(() => kind === 'templates' ? readTemplateDraft(id) : null);
  const [doc, setDoc] = useState<Document | null>(draft);
  const [isNew, setIsNew] = useState(Boolean(draft));
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [catalog, setCatalog] = useState<ComponentItem[]>([]);
  const [designFields, setDesignFields] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const editor = useRef<FlowformManageEditorHandle>(null);
  const operating = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const document = draft ? Promise.resolve(draft) : api.get(kind, id);
    document
      .then((value) => {
        if (!active) return;
        setDoc(value);
        setBindings(value.bindings || {});
        setDesignFields(Object.keys(value.schema.properties || {}));
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    if (kind === 'templates') {
      api
        .components()
        .then((value) => {
          if (active) setCatalog(value);
        })
        .catch((cause) => {
          if (active) setError(cause.message);
        });
    }
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [kind, id, draft]);

  const syncFields = (schema: SchemaNode) => {
    const currentFields = Object.keys(schema.properties || {});
    const currentBindings = Object.fromEntries(
      Object.entries(bindings).filter(([field]) => currentFields.includes(field)),
    );
    setDesignFields(currentFields);
    setBindings(currentBindings);
    return { currentFields, currentBindings };
  };

  const operate = async (action: 'read' | 'save' | 'publish') => {
    if (!doc || !ready || !editor.current || operating.current) return;
    operating.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const raw = await editor.current.readSchema();
      if (!mounted.current) return;
      const { currentFields, currentBindings } = syncFields(raw);
      if (action === 'read') return;
      const schema = kind === 'templates' ? clean(raw) : raw;
      if (kind === 'component-configs') {
        const missing = currentFields.filter((field) => !currentBindings[field]);
        if (missing.length) {
          throw new Error(`请先为字段 ${missing.join('、')} 选择目标属性`);
        }
      }
      const componentLocks: Record<string, ComponentLock> = { ...doc.componentLocks };
      if (kind === 'templates') {
        const used = usedComponents(schema);
        for (const name of Array.from(used)) {
          if (componentLocks[name]) continue;
          const item = catalog.find((candidate) => candidate.manifest.schemaComponent === name);
          if (!item) throw new Error(`${name} 没有已发布的远程版本`);
          const config = await api.published(
            'component-configs',
            `${item.componentName}:${item.version}`,
          );
          componentLocks[name] = {
            remoteName: item.componentName,
            version: item.version,
            configVersion: config.version,
          };
        }
        Object.keys(componentLocks).forEach((name) => {
          if (!used.has(name)) delete componentLocks[name];
        });
      }
      if (!mounted.current) return;
      const payload = {
        title: doc.title,
        schema,
        componentLocks,
        bindings: kind === 'component-configs' ? currentBindings : {},
      };
      const updated = isNew
        ? await api.create(kind, { id, ...payload })
        : await api.save(kind, id, { revision: doc.revision, ...payload });
      if (isNew) removeTemplateDraft(id);
      if (!mounted.current) return;
      setIsNew(false);
      setDoc(updated);
      if (action === 'publish') {
        const result = await api.publish(kind, id, updated.revision);
        if (!mounted.current) return;
        setDoc({ ...updated, publishedVersion: result.version });
        setMessage(`已发布 v${result.version}`);
      } else {
        setMessage('草稿已保存');
      }
    } catch (cause) {
      if (mounted.current) setError((cause as Error).message);
    } finally {
      operating.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  if (!doc) return <div>{error || '加载中...'}</div>;
  const targetOptions = id.toLowerCase().startsWith('card:') ? cardTargets : inputTargets;

  return (
    <div>
      {kind === 'component-configs' && (
        <>
          <Typography.Title level={3}>组件配置表单设计</Typography.Title>
          <Input
            value={doc.title}
            disabled={busy}
            onChange={(event) => setDoc({ ...doc, title: event.target.value })}
            style={{ maxWidth: 300, marginBottom: 12 }}
          />
        </>
      )}
      {error && <Alert type="error" message={error} style={{ marginBottom: 10 }} />}
      {kind === 'component-configs' && message && <Alert type="success" message={message} style={{ marginBottom: 10 }} />}
      {kind === 'component-configs' && (
        <div style={{ marginBottom: 12 }}>
          <Typography.Text>
            新增字段后点击“读取设计字段”，为字段绑定目标属性，再保存或发布：
          </Typography.Text>
          <Space wrap>
            {designFields.map((field) => (
              <Space key={field}>
                <span>{field}</span>
                <Select
                  style={{ width: 235 }}
                  value={bindings[field]}
                  disabled={busy}
                  placeholder="选择属性"
                  onChange={(target) =>
                    setBindings((previous) => ({ ...previous, [field]: target }))
                  }
                  options={targetOptions.map((target) => ({ label: target, value: target }))}
                />
              </Space>
            ))}
          </Space>
        </div>
      )}
      <Space style={{ marginBottom: 12 }}>
        {kind === 'component-configs' && (
          <Button disabled={!ready || busy} onClick={() => operate('read')}>
            读取设计字段
          </Button>
        )}
        <Button
          type={kind === 'templates' ? 'primary' : 'default'}
          disabled={!ready || busy}
          loading={busy}
          onClick={() => operate('save')}
        >
          {kind === 'templates' ? '保存' : '保存草稿'}
        </Button>
        {kind === 'component-configs' && (
          <Button type="primary" disabled={!ready || busy} onClick={() => operate('publish')}>
            发布
          </Button>
        )}
      </Space>
      <FlowformManageEditor
        ref={editor}
        kind={kind}
        id={id}
        schema={doc.schema}
        onReadyChange={setReady}
        onSave={() => operate('save')}
      />
    </div>
  );
};

const LowCodeManageEditorPage: React.FC<{ kind: Kind }> = ({ kind }) => {
  const { id = '' } = useParams();
  return <ManageEditor key={`${kind}:${id}`} kind={kind} id={id} />;
};

export default LowCodeManageEditorPage;
