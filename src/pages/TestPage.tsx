import React from 'react';
// @ts-ignore
import { Button } from 'zxz-component'
import { ReactRemoteComponent } from 'remote-component-loader';

const TestPage: React.FC = () => {
  return (
    <div>
      <h2>组件测试页面</h2>
      <div style={{ marginTop: '20px' }}>
        <h3>本地组件测试</h3>
        {/* @ts-ignore */}
        <Button label='test'></Button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>远程组件测试</h3>
        {/* @ts-ignore */}
        <ReactRemoteComponent 
          name='button' 
          version='1.0.0' 
          componentProps={{
            label: 'test1'
          }}
        />
      </div>
    </div>
  );
};

export default TestPage; 