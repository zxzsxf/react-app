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

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/test" replace />} />
            <Route path="test" element={<TestPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="theme" element={<ThemePage />} />
            <Route path="schema" element={<SchemaPage />} />
            <Route path="form-builder" element={<FormManagerPage />} />
            <Route path="forms/*" element={<DynamicFormPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
