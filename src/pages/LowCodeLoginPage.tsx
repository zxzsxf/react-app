import React, { useState } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lowcode/Auth';

const LowCodeLoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async ({ username, password }: { username: string; password: string }) => {
    setBusy(true); setError('');
    try { await login(username, password); navigate((location.state as any)?.from || '/m/forms', { replace: true }); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  return <main style={{ maxWidth: 360, margin: '12vh auto', padding: 24 }}><Typography.Title level={2}>低代码平台登录</Typography.Title>{error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}<Form layout="vertical" onFinish={submit}><Form.Item name="username" label="账号" rules={[{ required: true }]}><Input autoComplete="username" /></Form.Item><Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item><Button type="primary" htmlType="submit" loading={busy}>登录</Button></Form></main>;
};
export default LowCodeLoginPage;
