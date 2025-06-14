import React, { useEffect, useState } from 'react';
// @ts-ignore
import { Button } from 'zxz-component'
import { ReactRemoteComponent } from 'remote-component-loader';

interface ActiveComponent {
  path: string;
  time: number;
  version: string;
  publishInfo: {
    publisher: string;
    publishTime: number;
    description: string;
  };
}

interface ActiveComponents {
  [key: string]: ActiveComponent;
}

const TestPage: React.FC = () => {
  const [activeComponents, setActiveComponents] = useState<ActiveComponents>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let WINDOW_MICRO_CONFIG = window.microConfig || {};
  

  useEffect(() => {
    const fetchActiveComponents = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:1001/micro/config/active-components');
        const resJson = await response.json();
        const data = resJson.data || {};
        window.microConfig = data;
        setActiveComponents(data);
      } catch (err) {
        setError('获取远程组件配置失败');
      } finally {
        setLoading(false);
      }
    };
    if(!WINDOW_MICRO_CONFIG || Object.keys(WINDOW_MICRO_CONFIG).length === 0) {
      fetchActiveComponents();
    } else {
      setActiveComponents(WINDOW_MICRO_CONFIG);
    }
  }, []);

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
        {loading ? (
          <p>加载中...</p>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : (
          <div>
            {Object.entries(activeComponents).map(([componentName, componentInfo]) => (
              <div key={componentName} style={{ marginBottom: '20px', border: '1px solid #eee', padding: '15px' }}>
                <h4>组件名称: {componentName}</h4>
                <p>版本: {componentInfo.version}</p>
                <p>发布者: {componentInfo.publishInfo.publisher}</p>
                <p>发布时间: {new Date(componentInfo.publishInfo.publishTime).toLocaleString()}</p>
                <p>描述: {componentInfo.publishInfo.description}</p>
                <div style={{ marginTop: '10px', padding: '10px', background: '#f5f5f5' }}>
                  {/* @ts-ignore */}
                  <ReactRemoteComponent
                    name={componentName}
                    version={componentInfo.version}
                    componentProps={{
                      label: `${componentName}-${componentInfo.version}`,
                      title: `${componentName}-${componentInfo.version}`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestPage; 