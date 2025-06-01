import { useTheme } from '../styles/ThemeContext';

function ThemePage() {
  const { theme, setTheme } = useTheme();
  
  // 动态切换主题
  const changeTheme = () => {
    console.log('changeTheme');
    setTheme({
      primaryColor: '#f5222d',
      // 可以只更新部分主题属性
    });
  };
  
  return (
    <div style={{ color: theme.primaryColor }}>
      {/* 您的组件内容 */}
      <div onClick={changeTheme}>changeTheme</div>
    </div>
  );
}
export default ThemePage;