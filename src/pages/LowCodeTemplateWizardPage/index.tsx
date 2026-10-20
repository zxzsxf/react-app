import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Empty,
  Input,
  List,
  Space,
  Steps,
  Tag,
  Typography,
} from 'antd';
import { AppstoreOutlined, CodeOutlined, SettingOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import {
  api,
  ComponentItem,
  ComponentLock,
  Document,
  SchemaNode,
} from '../../lowcode/api';
import {
  FlowformManageEditor,
  FlowformManageEditorHandle,
} from '../../lowcode/FlowformManageEditor';
import {
  readTemplateDraft,
  removeTemplateDraft,
} from '../../lowcode/template-draft';
import LowCodeFormBuilderPage from '../LowCodeFormBuilderPage';
import { withComponentConfigs } from '../../lowcode/template-schema';
import './LowCodeTemplateWizardPage.css';

const emptySchema = (): SchemaNode => ({ type: 'object', properties: {} });

const TemplateWizard: React.FC<{ id: string }> = ({ id }) => {
  const [doc, setDoc] = useState<Document | null>(null);
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<ComponentItem[]>([]);
  const [focus, setFocus] = useState('');
  const [preview, setPreview] = useState<ComponentItem | null>(null);
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
    setPreview(item);
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
        kind: item.manifest.kind,
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

  const applyConfig = async () => {
    if (!doc || !editor.current || operating.current) return;
    operating.current = true;
    setBusy(true);
    setError('');
    try {
      const schema = await editor.current.readSchema();
      update({
        ...doc,
        componentLocks: {
          ...doc.componentLocks,
          [editing]: {
            ...doc.componentLocks[editing],
            configSchema: schema,
            configBindings: bindings,
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

  const save = async () => {
    if (!doc || operating.current) return;
    operating.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        title: doc.title.trim(),
        schema: withComponentConfigs(doc.schema, doc.componentLocks),
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
      setMessage('模板已保存');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      operating.current = false;
      setBusy(false);
    }
  };

  if (!doc) return <div>{error || '加载模板中...'}</div>;
  const focusedLock = doc.componentLocks[focus];
  const isSelected = !!focusedLock && (!preview || (
    focusedLock.remoteName === preview.componentName &&
    focusedLock.version === preview.version
  ));
  const focused: ComponentLock | undefined = isSelected
    ? focusedLock
    : preview ? {
        remoteName: preview.componentName,
        version: preview.version,
        configVersion: 0,
        displayName: preview.manifest.displayName,
        defaultFieldSchema: preview.manifest.defaultFieldSchema,
      } : undefined;
  const selectedCatalog: ComponentItem[] = Object.entries(
    doc.componentLocks,
  ).map(([name, lock]) => ({
    componentName: lock.remoteName,
    version: lock.version,
    manifest: {
      schemaComponent: name,
      displayName: lock.displayName || name,
      kind: lock.kind || catalog.find((item) => item.manifest.schemaComponent === name)?.manifest.kind ||
        (name === 'Card' ? 'container' : 'field'),
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
    <div className="template-wizard">
      <div className="template-wizard-content">
        {!editing && (
          <Steps current={step} style={{ marginBottom: 24 }}>
            <Steps.Step title="模板信息" />
            <Steps.Step title="选择组件与配置表单" />
            <Steps.Step title="配置表单模板" />
          </Steps>
        )}
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
          <div className="template-component-layout">
            <div>
              <Typography.Title level={5}>活跃组件</Typography.Title>
              <List
                bordered
                dataSource={catalog}
                locale={{ emptyText: '暂无可用的活跃组件' }}
                renderItem={(item) => {
                  const name = item.manifest.schemaComponent;
                  const lock = doc.componentLocks[name];
                  const checked = lock?.remoteName === item.componentName &&
                    lock?.version === item.version;
                  const active = focus === name && (!preview || (
                    preview.componentName === item.componentName &&
                    preview.version === item.version
                  ));
                  const showInfo = () => {
                    setFocus(name);
                    setPreview(item);
                  };
                  return (
                    <List.Item
                      className={`template-component-row${active ? ' is-active' : ''}`}
                      onClick={showInfo}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (
                          event.key === 'Enter' || event.key === ' '
                        )) {
                          event.preventDefault();
                          showInfo();
                        }
                      }}
                      tabIndex={0}
                      aria-label={`查看${item.manifest.displayName}组件信息`}
                      role="button"
                    >
                      <span onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          aria-label={`选择${item.manifest.displayName}`}
                          checked={checked}
                          onChange={(event) => choose(item, event.target.checked)}
                        />
                      </span>
                      <span className="template-component-name">
                        {item.manifest.displayName}
                      </span>
                      <Typography.Text type="secondary">v{item.version}</Typography.Text>
                    </List.Item>
                  );
                }}
              />
              <Typography.Title level={5}>已选组件</Typography.Title>
              <div className="template-selected-components">
                {!Object.keys(doc.componentLocks).length && (
                  <Typography.Text type="secondary">暂无已选组件</Typography.Text>
                )}
                {Object.entries(doc.componentLocks).map(([name, lock]) => (
                  <Button
                    key={name}
                    className={`template-selected-component${focus === name && isSelected ? ' is-active' : ''}`}
                    aria-pressed={focus === name && isSelected}
                    onClick={() => {
                      setFocus(name);
                      setPreview(null);
                    }}
                  >
                    <span className="template-selected-component-title">
                      {lock.displayName || name}
                    </span>
                    <span className="template-selected-component-version">v{lock.version}</span>
                  </Button>
                ))}
              </div>
            </div>
            <section className="template-component-detail" aria-label="组件信息">
              {focused ? (
                <>
                  <div className="template-detail-header">
                    <div className="template-detail-heading">
                      <span className="template-detail-icon" aria-hidden="true">
                        <AppstoreOutlined />
                      </span>
                      <div className="template-detail-title">
                        <Typography.Text type="secondary">组件信息</Typography.Text>
                        <Typography.Title level={4}>
                          {focused.displayName || focus}
                        </Typography.Title>
                        <Space size={8} wrap>
                          <Tag color="blue">v{focused.version}</Tag>
                          <Tag color={isSelected ? 'green' : 'default'}>
                            {isSelected ? '已加入模板' : '未选择'}
                          </Tag>
                        </Space>
                      </div>
                    </div>
                    <div className="template-detail-action">
                      <Button
                        type="primary"
                        icon={<SettingOutlined />}
                        disabled={!isSelected}
                        onClick={() => openConfig(focus, focused)}
                      >
                        配置组件
                      </Button>
                      {!isSelected && (
                        <Typography.Text type="secondary">
                          勾选该组件后即可配置
                        </Typography.Text>
                      )}
                    </div>
                  </div>
                  <div className="template-detail-body">
                    <dl className="template-detail-meta">
                      <div>
                        <dt>远程组件</dt>
                        <dd>{focused.remoteName}</dd>
                      </div>
                      <div>
                        <dt>组件标识</dt>
                        <dd>{focus}</dd>
                      </div>
                      <div>
                        <dt>配置字段</dt>
                        <dd>
                          <strong>
                            {Object.keys(focused.configSchema?.properties || {}).length}
                          </strong>
                          <span className="template-detail-unit">个字段</span>
                        </dd>
                      </div>
                    </dl>
                    <div className="template-schema-panel">
                      <div className="template-schema-header">
                        <span><CodeOutlined /> 默认字段 Schema</span>
                        <span className="template-schema-format">JSON</span>
                      </div>
                      {focused.defaultFieldSchema ? (
                        <pre className="template-schema-code" tabIndex={0} aria-label="默认字段 Schema">
                          <code>{JSON.stringify(focused.defaultFieldSchema, null, 2)}</code>
                        </pre>
                      ) : (
                        <div className="template-schema-empty">暂无默认字段 Schema</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="template-detail-empty">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <>
                        <Typography.Title level={5}>查看组件信息</Typography.Title>
                        <Typography.Text type="secondary">
                          点击左侧组件查看详情，勾选后可配置组件表单
                        </Typography.Text>
                      </>
                    }
                  />
                </div>
              )}
            </section>
          </div>
        )}
        {step === 1 && editing && (
          <div>
            <Typography.Title level={4}>
              {editing} · 配置表单编辑
            </Typography.Title>
            <Space wrap style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                disabled={!ready || busy}
                onClick={applyConfig}
              >
                应用配置并返回
              </Button>
              <Button disabled={busy} onClick={() => setEditing('')}>
                取消编辑
              </Button>
            </Space>
            <FlowformManageEditor
              key={editing}
              ref={editor}
              kind="component-configs"
              id={`${id}:${editing}`}
              schema={configSchema}
              onReadyChange={setReady}
              onSave={applyConfig}
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
      </div>
      {!editing && (
        <div className="template-wizard-footer">
          <div>
            {step > 0 && (
              <Button disabled={busy} onClick={() => setStep(step - 1)}>
                上一步
              </Button>
            )}
          </div>
          <Space wrap>
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
              <Button type="primary" loading={busy} onClick={save}>
                完成并保存模板
              </Button>
            )}
          </Space>
        </div>
      )}
    </div>
  );
};

const LowCodeTemplateWizardPage: React.FC = () => {
  const { id = '' } = useParams();
  return <TemplateWizard key={id} id={id} />;
};

export default LowCodeTemplateWizardPage;
