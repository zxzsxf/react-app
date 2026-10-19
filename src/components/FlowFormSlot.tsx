import React, { useEffect, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import { getForm, listForms, StoredForm } from '../flowforms/api';
import { openFormEditor } from '../flowforms/editor';
import StoredFormView from './StoredFormView';

const FlowFormSlot: React.FC<{ formCode: string; title: string }> = ({ formCode, title }) => {
  const [form, setForm] = useState<StoredForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listForms().then(index => {
      const record = index.find(item => item.formCode === formCode && item.placement === 'inline');
      return record ? getForm(formCode) : null;
    }).then(stored => {
      if (!stored) return;
      if (stored.placement === 'inline') setForm(stored);
      else setError('表单类型与页面区域不匹配');
    }).catch(cause => {
      if (cause.message !== '表单不存在') setError(cause.message);
    }).finally(() => setLoading(false));
  }, [formCode]);

  return (
    <section style={{ marginTop: 24, padding: 20, border: '1px solid #ddd' }}>
      <h3>{title}</h3>
      {process.env.NODE_ENV === 'development' && (
        <Button type="primary" style={{ marginBottom: 16 }} onClick={() => openFormEditor({ formCode, title, placement: 'inline' })}>
          {form ? '编辑表单' : '创建表单'}
        </Button>
      )}
      {loading ? <Spin /> : error ? <Alert type="error" message={error} /> : form ? <StoredFormView form={form} /> : <p>尚未创建表单</p>}
    </section>
  );
};

export default FlowFormSlot;
