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

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <BrowserRouter>
        <React.Suspense fallback={<div style={{ padding: 24 }}>加载页面中...</div>}>
        <Routes>
          <Route path="/login" element={<LowCodeLoginPage />} />
          <Route path="/m/forms/:formCode" element={<RequireAuth roles={['M', 'B', 'C']}><MobileLowCodeFormPage /></RequireAuth>} />
          <Route path="/m/forms" element={<RequireAuth roles={['M', 'B', 'C']}><MobileFormCatalogPage /></RequireAuth>} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/test" replace />} />
            <Route path="test" element={<TestPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="theme" element={<ThemePage />} />
            <Route path="schema" element={<SchemaPage />} />
            <Route path="form-builder" element={<RequireAuth roles={['B']}><LowCodeFormManagerPage /></RequireAuth>} />
            <Route path="form-builder/:formCode" element={<RequireAuth roles={['B']}><LowCodeFormBuilderPage /></RequireAuth>} />
            <Route path="legacy-form-builder" element={<FormManagerPage />} />
            <Route path="manage/templates" element={<RequireAuth roles={['M']}><LowCodeManagerPage kind="templates" /></RequireAuth>} />
            <Route path="manage/templates/:id" element={<RequireAuth roles={['M']}><LowCodeTemplateWizardPage /></RequireAuth>} />
            <Route path="manage/component-configs" element={<RequireAuth roles={['M']}><Navigate to="/manage/templates" replace /></RequireAuth>} />
            <Route path="manage/component-configs/:id" element={<RequireAuth roles={['M']}><LowCodeManageEditorPage kind="component-configs" /></RequireAuth>} />
            <Route path="forms/*" element={<DynamicFormPage />} />
          </Route>
        </Routes>
        </React.Suspense>
      </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
