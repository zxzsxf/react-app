import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/antd.css'; // 引入 antd 样式
import App from './App';

// 声明全局window类型
declare global {
  interface Window {
    microConfig: any;
  }
}

// 获取组件配置信息
const fetchComponentsInfo = async () => {
  try {
    const response = await fetch('http://localhost:4000/active-components');
    const data = await response.json() || {};
    window.microConfig = data;
  } catch (error) {
    console.error('Failed to fetch components info:', error);
    window.microConfig = {};
  } finally {
    console.log('获取组件配置信息完成');
  }
};

// 初始化应用
const initApp = async () => {
  await fetchComponentsInfo();
  
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
