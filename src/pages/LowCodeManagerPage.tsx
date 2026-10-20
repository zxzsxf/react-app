import React, { useEffect, useState } from 'react';
import { Alert, Button, Input, List, Select, Space, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { api, ActiveComponentItem, Document } from '../lowcode/api';
import { storeTemplateDraft } from '../lowcode/template-draft';

const LowCodeManagerPage: React.FC<{ kind: 'templates' | 'component-configs' }> = ({ kind }) => {
  const [items, setItems] = useState<Document[]>([]);
  const [components, setComponents] = useState<ActiveComponentItem[]>([]);
  const [name, setName] = useState('');
  const [choice, setChoice] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.list(kind).then(setItems).catch(cause => setError(cause.message));
    if (kind === 'component-configs') {
      api.activeComponents().then(setComponents).catch(cause => setError(cause.message));
    }
  }, [kind]);

  const create = async () => {
    setError('');
    try {
      const id = kind === 'templates' ? `t${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}` : choice;
      if (!id) throw new Error('请选择活跃组件');
      if (kind === 'templates') {
        storeTemplateDraft(id, name.trim() || '新模板');
        navigate(`/manage/templates/${encodeURIComponent(id)}`);
        return;
      }
      const document = await api.create(kind, {
        id,
        title: `${choice} 配置`,
        schema: { type: 'object', properties: {} },
        componentLocks: {},
        bindings: {},
      });
      navigate(`/manage/${kind}/${encodeURIComponent(id)}`);
      setItems([document, ...items]);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  return (
    <div>
      <Typography.Title level={2}>
        {kind === 'templates' ? '表单模板' : '组件配置表单'}
      </Typography.Title>
      {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}
      <Space style={{ marginBottom: 20 }}>
        {kind === 'templates' ? (
          <Input value={name} onChange={event => setName(event.target.value)} placeholder="模板名称" />
        ) : (
          <Select
            style={{ width: 280 }}
            value={choice || undefined}
            placeholder="选择组件"
            onChange={setChoice}
            options={components.map(item => ({
              label: item.metadata?.lowcode?.displayName || item.componentName,
              value: `${item.componentName}:${item.version}`,
            }))}
          />
        )}
        <Button type="primary" onClick={create}>创建</Button>
      </Space>
      <List
        bordered
        dataSource={items}
        locale={{ emptyText: '暂无记录' }}
        renderItem={item => (
          <List.Item actions={[
            <Link key="edit" to={`/manage/${kind}/${encodeURIComponent(item.id.slice(item.kind.length + 1))}`}>
              编辑
            </Link>,
          ]}>
            <Space>
              <strong>{item.title}</strong>
              <span>草稿 r{item.revision}</span>
              <span>{item.publishedVersion ? `已发布 v${item.publishedVersion}` : '未发布'}</span>
            </Space>
          </List.Item>
        )}
      />
    </div>
  );
};
export default LowCodeManagerPage;
