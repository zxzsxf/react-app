import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import TestPage from './pages/TestPage';
import ConfigPage from './pages/ConfigPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/test" replace />} />
          <Route path="test" element={<TestPage />} />
          <Route path="config" element={<ConfigPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
