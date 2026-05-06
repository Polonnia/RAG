import { useEffect, useState } from 'react';

/**
 * 主题管理钩子 - 支持浅色/深色主题切换
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  const [theme, setTheme] = useState('light');

  // 初始化主题
  useEffect(() => {
    // 从 localStorage 读取主题偏好
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    setTheme(savedTheme);
    setIsDark(savedTheme === 'dark');

    // 如果系统偏好深色，则使用系统偏好
    if (!localStorage.getItem('app-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      setIsDark(true);
    }

    applyTheme(savedTheme);
  }, []);

  // 应用主题
  const applyTheme = (themeType) => {
    const html = document.documentElement;
    
    if (themeType === 'dark') {
      html.setAttribute('data-theme', 'dark');
      html.style.colorScheme = 'dark';
    } else {
      html.setAttribute('data-theme', 'light');
      html.style.colorScheme = 'light';
    }
  };

  // 切换主题
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setIsDark(newTheme === 'dark');
    localStorage.setItem('app-theme', newTheme);
    applyTheme(newTheme);
  };

  // 设置特定主题
  const setThemeType = (themeType) => {
    setTheme(themeType);
    setIsDark(themeType === 'dark');
    localStorage.setItem('app-theme', themeType);
    applyTheme(themeType);
  };

  return {
    theme,
    isDark,
    toggleTheme,
    setTheme: setThemeType
  };
}

/**
 * 获取主题颜色
 */
export function getThemeColors(isDark = false) {
  return {
    light: {
      primary: '#1677ff',
      primaryLight: '#5b8def',
      primaryDark: '#0d47a1',
      
      background: '#f5f7fb',
      surface: '#ffffff',
      surfaceAlt: '#fafbfc',
      
      text: '#1a1a1a',
      textSecondary: '#595959',
      textTertiary: '#8c8c8c',
      
      border: '#d9d9d9',
      borderLight: '#e6f0ff',
      borderLighter: '#f0f5ff',
      
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f',
      info: '#1890ff'
    },
    dark: {
      primary: '#4d9cff',
      primaryLight: '#85bcff',
      primaryDark: '#177ddc',
      
      background: '#141414',
      surface: '#1f1f1f',
      surfaceAlt: '#262626',
      
      text: '#e8e8e8',
      textSecondary: '#b1bac4',
      textTertiary: '#8c8c8c',
      
      border: '#434343',
      borderLight: '#595959',
      borderLighter: '#434343',
      
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f',
      info: '#1890ff'
    }
  }[isDark ? 'dark' : 'light'];
}

/**
 * 获取主题相关的阴影
 */
export function getThemeShadows(isDark = false) {
  const isDarkTheme = isDark;
  
  return {
    xs: isDarkTheme ? '0 1px 2px rgba(0, 0, 0, 0.3)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
    sm: isDarkTheme ? '0 2px 8px rgba(0, 0, 0, 0.45)' : '0 2px 8px rgba(0, 0, 0, 0.06)',
    md: isDarkTheme ? '0 4px 12px rgba(0, 0, 0, 0.45)' : '0 4px 12px rgba(0, 0, 0, 0.08)',
    lg: isDarkTheme ? '0 8px 24px rgba(0, 0, 0, 0.45)' : '0 8px 24px rgba(0, 0, 0, 0.12)',
    xl: isDarkTheme ? '0 12px 32px rgba(0, 0, 0, 0.50)' : '0 12px 32px rgba(0, 0, 0, 0.15)',
  };
}

/**
 * 主题提供者组件（可选，如需全局主题管理）
 */
export function withTheme(Component) {
  return function ThemedComponent(props) {
    const { theme, isDark, toggleTheme, setTheme } = useTheme();

    return (
      <Component
        {...props}
        theme={theme}
        isDark={isDark}
        toggleTheme={toggleTheme}
        setTheme={setTheme}
      />
    );
  };
}

export default {
  useTheme,
  getThemeColors,
  getThemeShadows,
  withTheme
};
