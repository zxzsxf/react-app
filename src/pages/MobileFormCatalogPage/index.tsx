import React, { useEffect, useState } from 'react';
import { Alert, List, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { api } from '../../lowcode/api';

const MobileFormCatalogPage: React.FC = () => {
  const [forms, setForms] = useState<{ id: string; title: string; version: number }[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { api.publishedForms().then(setForms).catch(cause => setError(cause.message)); }, []);
  return <main style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}><Typography.Title level={3}>可填写表单</Typography.Title>{error && <Alert type="error" message={error} />}<List dataSource={forms} locale={{ emptyText: '暂无已发布表单' }} renderItem={form => <List.Item><Link to={`/m/forms/${form.id}`}>{form.title} · v{form.version}</Link></List.Item>} /></main>;
};
export default MobileFormCatalogPage;
