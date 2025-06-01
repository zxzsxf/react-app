import React, { createContext, useContext, useEffect, useState } from 'react';
import { defaultTheme, Theme } from './themes/default';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Partial<Theme>) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  const setTheme = (newTheme: Partial<Theme>) => {
    setThemeState((prevTheme) => ({
      ...prevTheme,
      ...newTheme,
    }));
  };

  useEffect(() => {
    // 更新CSS变量
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVarName, value.toString());
    });
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}; 