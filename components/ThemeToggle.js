import { useState, useEffect } from 'react';
import { MdLightMode, MdDarkMode, MdBrightness4, MdKeyboardArrowDown } from 'react-icons/md';
import { useTheme } from '../contexts/ThemeContext';
import styles from '../styles/ThemeToggle.module.css';

export default function ThemeToggle() {
  const { theme, toggleTheme, setSpecificTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // 组件挂载后标记为客户端渲染
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // 切换菜单显示/隐藏
  const toggleMenu = (e) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };
  
  // 选择主题并关闭菜单
  const selectTheme = (newTheme) => {
    setSpecificTheme(newTheme);
    setIsMenuOpen(false);
  };
  
  // 点击外部关闭菜单
  const closeMenu = () => {
    setIsMenuOpen(false);
  };
  
  // 组件挂载时添加全局点击事件
  useEffect(() => {
    // 确保代码只在客户端执行且组件已挂载
    if (mounted) {
      document.addEventListener('click', closeMenu);
      return () => {
        document.removeEventListener('click', closeMenu);
      };
    }
  }, [mounted]);

  // 如果组件尚未在客户端挂载，则返回一个占位符
  // 这样可以防止服务器端和客户端渲染差异导致的水合错误
  if (!mounted) {
    return (
      <div className={styles.themeToggleContainer}>
        <button className={styles.themeToggleButton} aria-label="主题设置">
          <MdBrightness4 size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.themeToggleContainer} onClick={(e) => e.stopPropagation()}>
      <button 
        onClick={toggleMenu}
        className={styles.themeToggleButton}
        title="主题设置"
      >
        {theme === 'system' ? (
          <MdBrightness4 size={24} />
        ) : theme === 'dark' ? (
          <MdDarkMode size={24} />
        ) : (
          <MdLightMode size={24} />
        )}
        <MdKeyboardArrowDown className={`${styles.arrow} ${isMenuOpen ? styles.arrowUp : ''}`} />
      </button>
      
      <div className={`${styles.themeOptions} ${isMenuOpen ? styles.open : ''}`}>
        <button 
          onClick={() => selectTheme('light')}
          className={`${styles.themeOption} ${theme === 'light' ? styles.active : ''}`}
          title="浅色模式"
        >
          <MdLightMode size={18} />
          <span>浅色</span>
        </button>
        <button 
          onClick={() => selectTheme('system')}
          className={`${styles.themeOption} ${theme === 'system' ? styles.active : ''}`}
          title="系统默认模式"
        >
          <MdBrightness4 size={18} />
          <span>跟随系统</span>
        </button>
        <button 
          onClick={() => selectTheme('dark')}
          className={`${styles.themeOption} ${theme === 'dark' ? styles.active : ''}`}
          title="深色模式"
        >
          <MdDarkMode size={18} />
          <span>深色</span>
        </button>
      </div>
    </div>
  );
} 