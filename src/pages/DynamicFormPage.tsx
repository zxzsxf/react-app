import React, { useEffect, useState } from 'react';
import { Alert, Spin, Typography } from 'antd';
import { useLocation } from 'react-router-dom';
import { getForm, listForms, StoredForm } from '../flowforms/api';
import StoredFormView from '../components/StoredFormView';

const DynamicFormPage: React.FC = () => {
  const { pathname } = useLocation();
  const [form, setForm] = useState<StoredForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setForm(null);
    listForms('express').then(index => {
      const record = index.find(item => item.placement === 'route' && item.path === pathname);
      if (!record) throw new Error('页面不存在');
      return getForm(record.formCode, 'express').then(stored => {
        if (stored.placement !== 'route' || stored.path !== pathname) throw new Error('表单路由配置不一致');
        setForm(stored);
      });
    }).catch(cause => setError(cause.message)).finally(() => setLoading(false));
  }, [pathname]);

  if (loading) return <Spin />;
  if (error || !form) return <Alert type="error" message={error || '页面不存在'} />;
  return <div><Typography.Title level={2}>{form.title}</Typography.Title><StoredFormView form={form} /></div>;
};

export default DynamicFormPage;
