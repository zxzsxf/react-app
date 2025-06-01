import React from 'react';
import { Layout, Menu } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ExperimentOutlined, SettingOutlined } from '@ant-design/icons';

const { Content, Sider } = Layout;

const MainLayout: React.FC = () => {
  const location = useLocation();

  const menuItems = [
    {
      key: '/test',
      icon: <ExperimentOutlined />,
      label: <Link to="/test">组件测试</Link>,
    },
    {
      key: '/config',
      icon: <SettingOutlined />,
      label: <Link to="/config">组件配置</Link>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)' }} />
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;