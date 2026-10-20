import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Input,
  List,
  Select,
  Space,
  Steps,
  Typography,
} from 'antd';
import { useParams } from 'react-router-dom';
import {
  api,
  ComponentItem,
  ComponentLock,
  Document,
  SchemaNode,
} from '../lowcode/api';
import {
  FlowformManageEditor,
  FlowformManageEditorHandle,
} from '../lowcode/FlowformManageEditor';
import {
  readTemplateDraft,
  removeTemplateDraft,
} from '../lowcode/template-draft';
import LowCodeFormBuilderPage from './LowCodeFormBuilderPage';

const emptySchema = (): SchemaNode => ({ type: 'object', properties: {} });
const targetsFor = (name: string) => {
  const props: Record<string, string[]> = {
    Input: ['placeholder', 'disabled'],
    Card: ['title'],
    Button: ['label'],
  };
  return [
    'title',
    ...(name === 'Input' ? ['required'] : []),
    ...(props[name] || []).map((prop) => `x-component-props.${prop}`),
  ];
};

const TemplateWizard: React.FC<{ id: string }> = ({ id }) => {
  const [doc, setDoc] = useState<Document | null>(null);
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<ComponentItem[]>([]);
  const [focus, setFocus] = useState('');
  const [editing, setEditing] = useState('');
  const [configSchema, setConfigSchema] = useState<SchemaNode>(emptySchema);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const editor = useRef<FlowformManageEditorHandle>(null);
  const operating = useRef(false);

  useEffect(() => {
    let active = true;
    const draft = readTemplateDraft(id);
    Promise.all([
      draft ? Promise.resolve(draft) : api.get('templates', id),
      api.components(),
      api.activeComponents(),
    ])
      .then(([document, components, available]) => {
        if (!active) return;
        setDoc(document);
        setCatalog(
          components.filter((item) =>
            available.some(
              (candidate) =>
                candidate.componentName === item.componentName &&
                candidate.version === item.version,
            ),
          ),
        );
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (doc && doc.revision === 0)
      sessionStorage.setItem(
        `lowcode:template-draft:${id}`,
        JSON.stringify(doc),
      );
  }, [doc, id]);

  const update = (next: Document) => {
    setDoc(next);
    setMessage('');
  };

  const choose = (item: ComponentItem, checked: boolean) => {
    if (!doc) return;
    const name = item.manifest.schemaComponent;
    setFocus(name);
    const locks = { ...doc.componentLocks };
    if (checked) {
      if (
        locks[name] &&
        (locks[name].version !== item.version ||
          locks[name].remoteName !== item.componentName)
      ) {
        setError('同一模板不能选择同名组件的多个版本，请先移除旧版本');
        return;
      }
      locks[name] = {
        remoteName: item.componentName,
        version: item.version,
        configVersion: 0,
        displayName: item.manifest.displayName,
        defaultFieldSchema: item.manifest.defaultFieldSchema,
        configSchema: emptySchema(),
        configBindings: {},
      };
    } else {
      const used = (node: SchemaNode): boolean =>
        node['x-component'] === name ||
        Object.values(node.properties || {}).some(used);
      if (used(doc.schema)) {
        setError('请先在第三步删除画布中的该组件，再取消选择');
        return;
      }
      delete locks[name];
    }
    setError('');
    update({ ...doc, componentLocks: locks });
  };

  const openConfig = async (name: string, lock: ComponentLock) => {
    setError('');
    try {
      const config = lock.configSchema
        ? { schema: lock.configSchema, bindings: lock.configBindings || {} }
        : await api.versioned(
            'component-configs',
            `${lock.remoteName}:${lock.version}`,
            lock.configVersion,
          );
      setConfigSchema(config.schema);
      setBindings(config.bindings);
      setReady(false);
      setEditing(name);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const readConfig = async (apply: boolean) => {
    if (!doc || !editor.current || operating.current) return;
    operating.current = true;
    setBusy(true);
    setError('');
    try {
      const schema = await editor.current.readSchema();
      const fields = Object.keys(schema.properties || {});
      const currentBindings = Object.fromEntries(
        Object.entries(bindings).filter(([key]) => fields.includes(key)),
      );
      setConfigSchema(schema);
      setBindings(currentBindings);
      if (!apply) return;
      if (fields.some((field) => !currentBindings[field]))
        throw new Error('请为每个配置字段选择目标属性');
      update({
        ...doc,
        componentLocks: {
          ...doc.componentLocks,
          [editing]: {
            ...doc.componentLocks[editing],
            configSchema: schema,
            configBindings: currentBindings,
          },
        },
      });
      setEditing('');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      operating.current = false;
      setBusy(false);
    }
  };

  const save = async (publish: boolean) => {
    if (!doc || operating.current) return;
    operating.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        title: doc.title.trim(),
        schema: doc.schema,
        componentLocks: doc.componentLocks,
        bindings: {},
      };
      const saved =
        doc.revision === 0
          ? await api.create('templates', { id, ...payload })
          : await api.save('templates', id, {
              revision: doc.revision,
              ...payload,
            });
      setDoc(saved);
      removeTemplateDraft(id);
      if (publish) {
        const result = await api.publish('templates', id, saved.revision);
        setDoc({ ...saved, publishedVersion: result.version });
        setMessage(`模板已保存并发布 v${result.version}`);
      } else {
        setMessage('模板已保存');
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      operating.current = false;
      setBusy(false);
    }
  };

  if (!doc) return <div>{error || '加载模板中...'}</div>;
  const focused = doc.componentLocks[focus];
  const selectedCatalog: ComponentItem[] = Object.entries(
    doc.componentLocks,
  ).map(([name, lock]) => ({
    componentName: lock.remoteName,
    version: lock.version,
    manifest: {
      schemaComponent: name,
      displayName: lock.displayName || name,
      kind: name === 'Card' ? 'container' : 'field',
      defaultFieldSchema: lock.defaultFieldSchema ||
        catalog.find((item) => item.manifest.schemaComponent === name)?.manifest
          .defaultFieldSchema || {
          type: name === 'Input' ? 'string' : 'void',
          'x-component': name,
        },
      allowedProps: [],
    },
  }));

  return (
    <div>
      <Typography.Title level={2}>表单模板配置</Typography.Title>
      <Steps current={step} style={{ marginBottom: 24 }}>
        <Steps.Step title="模板信息" />
        <Steps.Step title="选择组件与配置表单" />
        <Steps.Step title="配置表单模板" />
      </Steps>
      {error && (
        <Alert type="error" message={error} style={{ marginBottom: 16 }} />
      )}
      {message && (
        <Alert type="success" message={message} style={{ marginBottom: 16 }} />
      )}
      {step === 0 && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>模板名称 *</Typography.Text>
          <Input
            aria-label="模板名称"
            maxLength={160}
            value={doc.title}
            onChange={(event) => update({ ...doc, title: event.target.value })}
            style={{ maxWidth: 400 }}
          />
          <Descriptions column={1}>
            <Descriptions.Item label="模板 ID">{id}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {doc.createdAt
                ? new Date(doc.createdAt).toLocaleString()
                : '完成第三步保存时生成'}
            </Descriptions.Item>
          </Descriptions>
          <Typography.Text type="secondary">
            信息暂存在当前浏览器，完成第三步后统一保存。
          </Typography.Text>
        </Space>
      )}
      {step === 1 && !editing && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '300px minmax(0, 1fr)',
            gap: 24,
          }}
        >
          <div>
            <Typography.Title level={5}>活跃组件</Typography.Title>
            <List
              bordered
              dataSource={catalog}
              locale={{ emptyText: '暂无可用的活跃组件' }}
              renderItem={(item) => {
                const name = item.manifest.schemaComponent;
                const lock = doc.componentLocks[name];
                return (
                  <List.Item>
                    <Checkbox
                      checked={
                        lock?.remoteName === item.componentName &&
                        lock?.version === item.version
                      }
                      onChange={(event) => choose(item, event.target.checked)}
                    >
                      {item.manifest.displayName}
                    </Checkbox>
                  </List.Item>
                );
              }}
            />
            <Typography.Title level={5}>已选组件</Typography.Title>
            <Space wrap>
              {Object.entries(doc.componentLocks).map(([name, lock]) => (
                <Button
                  key={name}
                  type={focus === name ? 'primary' : 'default'}
                  onClick={() => setFocus(name)}
                >
                  {lock.displayName || name}
                </Button>
              ))}
            </Space>
          </div>
          <div>
            {focused ? (
              <>
                <Descriptions title="组件信息" column={1}>
                  <Descriptions.Item label="名称">
                    {focused.displayName || focus}
                  </Descriptions.Item>
                  <Descriptions.Item label="远程组件">
                    {focused.remoteName}
                  </Descriptions.Item>
                  <Descriptions.Item label="版本">
                    {focused.version}
                  </Descriptions.Item>
                  <Descriptions.Item label="配置字段">
                    {Object.keys(focused.configSchema?.properties || {}).length}
                  </Descriptions.Item>
                </Descriptions>
                <Button
                  type="primary"
                  onClick={() => openConfig(focus, focused)}
                >
                  配置组件
                </Button>
                <pre
                  style={{ marginTop: 16, maxHeight: 300, overflow: 'auto' }}
                >
                  {JSON.stringify(focused.defaultFieldSchema, null, 2)}
                </pre>
              </>
            ) : (
              <Typography.Text>
                从左侧选择组件，查看信息并编辑组件的配置表单。
              </Typography.Text>
            )}
          </div>
        </div>
      )}
      {step === 1 && editing && (
        <div>
          <Typography.Title level={4}>
            {editing} · 配置表单编辑
          </Typography.Title>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button disabled={!ready || busy} onClick={() => readConfig(false)}>
              读取设计字段
            </Button>
            <Button
              type="primary"
              disabled={!ready || busy}
              onClick={() => readConfig(true)}
            >
              应用配置并返回
            </Button>
            <Button disabled={busy} onClick={() => setEditing('')}>
              取消编辑
            </Button>
            {Object.keys(configSchema.properties || {}).map((field) => (
              <Space key={field}>
                <span>{field}</span>
                <Select
                  style={{ width: 240 }}
                  placeholder="选择目标属性"
                  value={bindings[field]}
                  onChange={(value) =>
                    setBindings((previous) => ({ ...previous, [field]: value }))
                  }
                  options={targetsFor(editing).map((value) => ({
                    label: value,
                    value,
                  }))}
                />
              </Space>
            ))}
          </Space>
          <FlowformManageEditor
            key={editing}
            ref={editor}
            kind="component-configs"
            id={`${id}:${editing}`}
            schema={configSchema}
            onReadyChange={setReady}
            onSave={() => readConfig(true)}
          />
        </div>
      )}
      {step === 2 && (
        <LowCodeFormBuilderPage
          template={{
            document: doc,
            catalog: selectedCatalog,
            onChange: update,
          }}
        />
      )}
      {!editing && (
        <Space style={{ marginTop: 24 }}>
          {step > 0 && (
            <Button disabled={busy} onClick={() => setStep(step - 1)}>
              上一步
            </Button>
          )}
          {step < 2 && (
            <Button
              type="primary"
              disabled={
                !doc.title.trim() ||
                (step === 1 && !Object.keys(doc.componentLocks).length)
              }
              onClick={() => setStep(step + 1)}
            >
              下一步
            </Button>
          )}
          {step === 2 && (
            <>
              <Button type="primary" loading={busy} onClick={() => save(false)}>
                完成并保存模板
              </Button>
              <Button disabled={busy} onClick={() => save(true)}>
                保存并发布模板
              </Button>
            </>
          )}
        </Space>
      )}
    </div>
  );
};

const LowCodeTemplateWizardPage: React.FC = () => {
  const { id = '' } = useParams();
  return <TemplateWizard key={id} id={id} />;
};

export default LowCodeTemplateWizardPage;
