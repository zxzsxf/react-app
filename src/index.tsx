import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/antd.css'; // 引入 antd 样式
import App from './App';
import { initMicro } from 'remote-component-loader';

// 忽略 defaultProps 警告
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('defaultProps')) return;
  originalError.call(console, ...args);
};

// 声明全局window类型
declare global {
  interface Window {
    microConfig: any;
  }
}

// 获取组件配置信息
const fetchComponentsInfo = async () => {
  try {
    const response = await fetch('http://localhost:1001/micro/config/active-components');
    const responseJson = await response.json() || {};
    const data = responseJson.data || {};
    window.microConfig = data;
  } catch (error) {
    console.error('获取组件配置信息失败:', error);
    window.microConfig = {};
  } finally {
    console.log('获取组件配置信息完成');
  }
};

// 初始化应用
const initApp = async () => {
  await fetchComponentsInfo();
  initMicro('http://localhost:1001/micro/components/find', 'test-react-app');
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// 启动应用
initApp();
