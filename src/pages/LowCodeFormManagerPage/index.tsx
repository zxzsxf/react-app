import React, { useEffect, useState } from 'react';
import { Alert, Button, Input, List, Select, Space, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { api, Document } from '../../lowcode/api';

const LowCodeFormManagerPage: React.FC = () => {
  const [forms, setForms] = useState<Document[]>([]);
  const [templates, setTemplates] = useState<Document[]>([]);
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => { api.list('forms').then(setForms).catch(cause => setError(cause.message)); api.list('templates').then(setTemplates).catch(() => {}); }, []);
  const create = async () => {
    setError('');
    try {
      const id = `f${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      await api.create('forms', { id, title: title.trim() || '新表单', ...(templateId ? { templateId } : {}) });
      navigate(`/form-builder/${id}`);
    } catch (cause) { setError((cause as Error).message); }
  };
  return <div><Typography.Title level={2}>业务表单</Typography.Title>{error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}
    <Space style={{ marginBottom: 20 }}><Input value={title} onChange={event => setTitle(event.target.value)} placeholder="表单名称" /><Select style={{ width: 250 }} value={templateId || undefined} placeholder="空白表单" allowClear onChange={value => setTemplateId(value || '')} options={templates.filter(item => item.publishedVersion).map(item => ({ label: `${item.title} v${item.publishedVersion}`, value: item.id.slice('template:'.length) }))} /><Button type="primary" onClick={create}>创建</Button></Space>
    <List bordered dataSource={forms} locale={{ emptyText: '暂无业务表单' }} renderItem={item => <List.Item actions={[<Link key="edit" to={`/form-builder/${item.id.slice('form:'.length)}`}>搭建</Link>, ...(item.publishedVersion ? [<Link key="view" to={`/m/forms/${item.id.slice('form:'.length)}`}>查看 C 端</Link>] : [])]}><Space><strong>{item.title}</strong><span>草稿 r{item.revision}</span><span>{item.publishedVersion ? `已发布 v${item.publishedVersion}` : '未发布'}</span></Space></List.Item>} />
    <div style={{ marginTop: 20 }}><Link to="/legacy-form-builder">查看旧版表单</Link></div>
  </div>;
};
export default LowCodeFormManagerPage;
