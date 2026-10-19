import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, List, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { FormMeta, listForms } from '../flowforms/api';
import { formRoutePattern, openFormEditor } from '../flowforms/editor';

const FormManagerPage: React.FC = () => {
  const [forms, setForms] = useState<FormMeta[]>([]);
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    listForms('express').then(setForms).catch(cause => setError(cause.message));
  }, []);

  const create = (values: { title: string; path: string }) => {
    const path = values.path.trim();
    if (forms.some(item => item.path === path)) {
      setError('路由地址已存在');
      return;
    }
    const formCode = `f${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    try { openFormEditor({ formCode, title: values.title.trim(), placement: 'route', path }); }
    catch (cause) { setError((cause as Error).message); }
  };

  const edit = (item: FormMeta) => {
    try { openFormEditor(item); }
    catch (cause) { setError((cause as Error).message); }
  };

  return (
    <div>
      <Typography.Title level={2}>表单管理</Typography.Title>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      {process.env.NODE_ENV === 'development' && <Form form={form} layout="vertical" onFinish={create} style={{ maxWidth: 480 }}>
          <Form.Item name="title" label="表单名称" rules={[{ required: true, whitespace: true, message: '请输入表单名称' }, { max: 100 }]}>
            <Input placeholder="例如：客户登记" />
          </Form.Item>
          <Form.Item name="path" label="路由地址" rules={[
            { required: true, message: '请输入路由地址' },
            { validator: (_, value) => !value || formRoutePattern.test(value.trim()) ? Promise.resolve() : Promise.reject(new Error('使用 /forms/ 开头的小写路径')) },
          ]}>
            <Input placeholder="/forms/customer" />
          </Form.Item>
          <Button type="primary" htmlType="submit">创建表单</Button>
      </Form>}
      <Typography.Title level={4} style={{ marginTop: 28 }}>已创建的独立表单</Typography.Title>
      <List
        bordered
        dataSource={forms.filter(item => item.placement === 'route')}
        locale={{ emptyText: '暂无表单' }}
        renderItem={item => (
          <List.Item actions={[
            <Button key="edit" onClick={() => edit(item)}>编辑</Button>,
          ]}>
            <Space direction="vertical">
              <strong>{item.title}</strong>
              {item.path && <Link to={item.path}>{item.path}</Link>}
            </Space>
          </List.Item>
        )}
      />
    </div>
  );
};

export default FormManagerPage;
