import React, { useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { menuItems } from '../router/TestPage';
import type { MenuProps } from 'antd';
import { useAuth } from '../lowcode/Auth';

const { Content, Sider } = Layout;

interface MenuItemType {
  key: string;
  icon: React.ReactNode;
  label: React.ReactNode;
  roles?: string[];
}

const MainLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  // 转换菜单项格式
  const items: MenuProps['items'] = menuItems.filter((item: MenuItemType) => !item.roles || item.roles.some(role => user?.roles.includes(role as any))).map((item: MenuItemType) => ({
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
        selectedKeys={[location.pathname]}
        defaultOpenKeys={['sub1']}
        mode="inline"
        theme="dark"
        items={items}
      />
        {user && <div style={{ padding: 12, color: 'white' }}><div>{user.username}</div><Button size="small" onClick={() => logout().then(() => navigate('/login'))}>退出登录</Button></div>}
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
