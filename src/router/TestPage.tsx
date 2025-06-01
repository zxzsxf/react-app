import { ExperimentOutlined, SettingOutlined } from '@ant-design/icons';
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
  ];