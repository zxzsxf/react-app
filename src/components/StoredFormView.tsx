import React, { useRef, useState } from 'react';
import { Alert, Button, Space } from 'antd';
import { FlowFormRenderer } from 'flowform-pc';
import { StoredForm } from '../flowforms/api';

const StoredFormView: React.FC<{ form: StoredForm }> = ({ form }) => {
  const formRef = useRef<any>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [feedback, setFeedback] = useState('');

  const validate = async () => {
    try {
      const result = await formRef.current?.submit();
      setFeedback(`校验通过：${JSON.stringify(result || values)}`);
    } catch {
      setFeedback('请检查表单中未通过校验的字段');
    }
  };

  return (
    <div>
      <FlowFormRenderer key={form.formCode} schema={form.schema} onChange={setValues} formRef={formRef} />
      <Space style={{ marginTop: 16 }}>
        <Button onClick={validate}>校验并读取表单值</Button>
      </Space>
      {feedback && <Alert style={{ marginTop: 12 }} type="info" message={feedback} />}
    </div>
  );
};

export default StoredFormView;
