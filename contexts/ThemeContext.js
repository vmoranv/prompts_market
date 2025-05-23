import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'system',
  isDark: false,
  toggleTheme: () => {},
  setSpecificTheme: () => {}
});

export function ThemeProvider({ children }) {
  // 默认使用深色主题
  const [theme, setTheme] = useState('dark'); 
  const [isDark, setIsDark] = useState(true); // 初始isDark也为true
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // 确保代码只在客户端执行
    if (typeof window === 'undefined') return;
    
    // 从本地存储读取用户主题偏好，如果不存在则默认为 'dark'
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    
    // 初始化时检测系统偏好
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // 根据保存的主题或系统偏好（当主题为system时）设置isDark
    if (savedTheme === 'dark') {
      setIsDark(true);
    } else if (savedTheme === 'light') {
      setIsDark(false);
    } else { // 'system'
      setIsDark(prefersDark);
    }

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        setIsDark(mediaQuery.matches);
      }
    };
    
    // 使用更安全的事件监听方法
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      // Safari 和较老的浏览器
      mediaQuery.addListener(handleChange);
    }
    
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [theme]);

  // 切换主题函数
  const toggleTheme = () => {
    if (!mounted) return;
    
    // 在深色和浅色之间切换，不再使用 'system' 作为中间态
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
    setIsDark(newTheme === 'dark');
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
  };

  // 设置特定主题
  const setSpecificTheme = (newTheme) => {
    if (!mounted) return;
    
    setTheme(newTheme);
    if (newTheme === 'system') {
      const prefersDark = typeof window !== 'undefined' 
        ? window.matchMedia('(prefers-color-scheme: dark)').matches 
        : false;
      setIsDark(prefersDark);
    } else {
      setIsDark(newTheme === 'dark');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }
  }, [isDark, mounted]);

  const value = {
    theme,
    isDark,
    toggleTheme,
    setSpecificTheme
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
} 