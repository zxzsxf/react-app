主题系统，让我为您总结一下使用方法：

1. 文件结构：

* src/styles/variables.scss: 包含所有SCSS变量
* src/styles/base.scss: 基础样式和工具类
* src/styles/themes/default.ts: 默认主题配置
* src/styles/ThemeContext.tsx: 主题管理上下文
* src/components/ThemeExample.tsx: 使用示例

1. 如何使用：

首先在应用的根组件中包裹 ThemeProvider：

```
import { ThemeProvider } from './styles/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      {/* 您的应用组件 */}
    </ThemeProvider>
  );
}
```

在组件中使用主题：

```
import { useTheme } from './styles/ThemeContext';

function MyComponent() {
  const { theme, setTheme } = useTheme();
  
  // 动态切换主题
  const changeTheme = () => {
    setTheme({
      primaryColor: '#f5222d',
      // 可以只更新部分主题属性
    });
  };
  
  return (
    <div style={{ color: theme.primaryColor }}>
      {/* 您的组件内容 */}
    </div>
  );
}
```

1. 特性：

* 支持动态切换主题
* 提供了常用的工具类（间距、文本颜色等）
* 使用CSS变量实现主题切换，性能好
* TypeScript支持，提供类型检查
* 支持部分主题属性更新

1. 样式使用方式：

* 直接使用SCSS变量：$primary-color
* 使用CSS变量：var(--primary-color)
* 使用工具类：.text-primary, .margin-sm 等
* 通过 useTheme hook 获取主题对象

要开始使用这个主题系统，您需要：

1. 确保已安装必要的依赖：

   **npm** **install** **react** **@types/react** **sass**
2. 在您的组件中导入基础样式：

   **import** **'../styles/base.scss'**;
3. 使用 ThemeProvider 包裹您的应用。

这个主题系统非常灵活，您可以：* 轻松添加新的主题变量

* 创建多个预设主题
* 动态切换主题
* 自定义工具类

如果您需要添加新的主题变量，只需要：

1. 在 variables.scss 中添加新变量
2. 在 default.ts 中添加对应的主题属性
3. 更新 Theme 类型定义
