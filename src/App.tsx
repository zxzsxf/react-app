import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import TestPage from './pages/TestPage';
import ConfigPage from './pages/ConfigPage';
import ThemePage from './pages/ThemePage';
import { ThemeProvider } from './styles/ThemeContext';
import SchemaPage from './pages/SchemaPage';
import FormManagerPage from './pages/FormManagerPage';
import DynamicFormPage from './pages/DynamicFormPage';
import { AuthProvider, RequireAuth } from './lowcode/Auth';
import LowCodeLoginPage from './pages/LowCodeLoginPage';
import LowCodeFormManagerPage from './pages/LowCodeFormManagerPage';
import LowCodeFormBuilderPage from './pages/LowCodeFormBuilderPage';
import LowCodeManagerPage from './pages/LowCodeManagerPage';
import MobileLowCodeFormPage from './pages/MobileLowCodeFormPage';
import MobileFormCatalogPage from './pages/MobileFormCatalogPage';
const LowCodeTemplateWizardPage = React.lazy(() => import('./pages/LowCodeTemplateWizardPage'));
const LowCodeManageEditorPage = React.lazy(() => import('./pages/LowCodeManageEditorPage'));
const AIChatPage = React.lazy(() => import('./pages/AIChatPage'));

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
          {/* 低代码平台登录 */}
          <Route path="/login" element={<LowCodeLoginPage />} />
          {/* 组件测试 */}
          <Route path="test" element={<TestPage />} />
          {/* 组件配置 */}
          <Route path="config" element={<ConfigPage />} />
          {/* 主题 */}
          <Route path="theme" element={<ThemePage />} />
          <Route index element={<Navigate to="/test" replace />} />


          {/* 移动表单 */}
          <Route path="/m/forms/:formCode" element={<RequireAuth roles={['M', 'B', 'C']}><MobileLowCodeFormPage /></RequireAuth>} />
          {/* 可填写表单 */}
          <Route path="/m/forms" element={<RequireAuth roles={['M', 'B', 'C']}><MobileFormCatalogPage /></RequireAuth>} />
          
          {/* H5 表单 */}
          <Route path="schema" element={<SchemaPage />} />
          {/* 业务表单 */}
          <Route path="form-builder" element={<RequireAuth roles={['B']}><LowCodeFormManagerPage /></RequireAuth>} />
          <Route path="ai-chat" element={<RequireAuth roles={['B']}><AIChatPage /></RequireAuth>} />
          {/* 表单搭建 */}
          <Route path="form-builder/:formCode" element={<RequireAuth roles={['B']}><LowCodeFormBuilderPage /></RequireAuth>} />
          {/* 旧版表单管理 */}
          <Route path="legacy-form-builder" element={<FormManagerPage />} />
          {/* 模板管理 */}
          <Route path="manage/templates" element={<RequireAuth roles={['M']}><LowCodeManagerPage kind="templates" /></RequireAuth>} />
          {/* 模板配置向导 */}
          <Route path="manage/templates/:id" element={<RequireAuth roles={['M']}><LowCodeTemplateWizardPage /></RequireAuth>} />
          <Route path="manage/component-configs" element={<RequireAuth roles={['M']}><Navigate to="/manage/templates" replace /></RequireAuth>} />
          {/* 组件配置表单设计 */}
          <Route path="manage/component-configs/:id" element={<RequireAuth roles={['M']}><LowCodeManageEditorPage kind="component-configs" /></RequireAuth>} />
          {/* 动态表单 */}
          <Route path="forms/*" element={<DynamicFormPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
