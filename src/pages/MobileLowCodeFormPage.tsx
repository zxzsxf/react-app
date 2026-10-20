import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import { api, Snapshot } from '../lowcode/api';
import { LowCodeRenderer, MobileFormHandle } from '../lowcode/MobileRenderer';

const MobileLowCodeFormPage: React.FC = () => {
  const { formCode = '' } = useParams();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef<MobileFormHandle>(null);
  useEffect(() => { api.published('forms', formCode).then(setSnapshot).catch(cause => setError(cause.message)); }, [formCode]);
  const submit = async () => {
    if (!formRef.current || !snapshot) return;
    setError(''); setBusy(true);
    try { const values = await formRef.current.submit(); const result = await api.submit(formCode, snapshot.version, values); setSuccess(`提交成功，记录编号 ${result.id}`); }
    catch (cause) { setError((cause as Error).message || '请检查表单内容'); }
    finally { setBusy(false); }
  };
  return <main style={{ maxWidth: 480, minHeight: '100vh', margin: '0 auto', padding: '20px 12px', background: '#fff' }}>
    <Typography.Title level={3}>{snapshot?.title || '移动表单'}</Typography.Title>
    {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
    {success ? <Alert type="success" message={success} /> : snapshot ? <><LowCodeRenderer schema={snapshot.schema} locks={snapshot.componentLocks} formRef={formRef} /><Button type="primary" block size="large" loading={busy} onClick={submit}>提交</Button></> : !error ? <div>加载表单中...</div> : null}
  </main>;
};
export default MobileLowCodeFormPage;
