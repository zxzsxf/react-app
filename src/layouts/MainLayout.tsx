import React, { useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { menuItems } from '../router/TestPage';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Content, Sider } = Layout;

interface MenuItemType {
  key: string;
  icon: React.ReactNode;
  label: React.ReactNode;
}

const MainLayout: React.FC = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  // 转换菜单项格式
  const items: MenuProps['items'] = menuItems.map((item: MenuItemType) => ({
    key: item.key,
    // icon: item.icon,
    label: item.label,
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        width={200} 
        collapsible
        collapsed={collapsed}
        onCollapse={toggleCollapsed}
        style={{ 
          background: '#001529',
          // position: 'fixed',
          left: 0,
          height: '100vh',
          // overflow: 'auto'
        }}
      >
        <div className="logo" style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)' }} />
     <Menu
        defaultSelectedKeys={['1']}
        defaultOpenKeys={['sub1']}
        mode="inline"
        theme="dark"
        items={items}
      />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 15, transition: 'all 0.2s' }}>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: '#fff',
            minHeight: 360,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;