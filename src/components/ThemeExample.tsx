import React from 'react';
import { useTheme } from '../styles/ThemeContext';
import '../styles/base.scss';

export const ThemeExample: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const handleChangeTheme = () => {
    setTheme({
      primaryColor: '#f5222d',
      textColorPrimary: 'rgba(0, 0, 0, 0.95)',
      bgColorBase: '#f0f2f5',
    });
  };

  return (
    <div className="padding-md">
      <h1 style={{ color: theme.primaryColor }}>主题示例</h1>
      <p className="text-primary margin-sm">这是一段使用主题的文本</p>
      <button
        onClick={handleChangeTheme}
        style={{
          backgroundColor: theme.primaryColor,
          color: theme.bgColorBase,
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        切换主题
      </button>
    </div>
  );
}; 