import { ExperimentOutlined, SettingOutlined, FormOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

export const menuItems = [
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
    {
      key: '/theme',
      icon: <SettingOutlined />,
      label: <Link to="/theme">主题</Link>,
    },
    {
      key: '/form-builder',
      // roles: ['B'],
      icon: <FormOutlined />,
      label: <Link to="/form-builder">表单管理</Link>,
    },
    { key: '/manage/templates', roles: ['M'], icon: <FormOutlined />, label: <Link to="/manage/templates">模板管理</Link> },
    {
      key: '/schema',
      icon: <SettingOutlined />,
      label: <Link to="/schema">h5表单</Link>,
    },
  ];
