import { useState, useEffect } from 'react';
import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "../contexts/ThemeContext";
import { startCacheCleanup, warmupCommonData, getCacheStats } from '../utils/cache';
import Nav from '../components/Nav';
import '../styles/globals.css';

// 仅在开发环境中导入 Stagewise
const StagewiseToolbar = process.env.NODE_ENV === 'development' 
  ? require('@stagewise/toolbar-next').StagewiseToolbar 
  : null;

// 创建一个内部组件来包含需要访问 session 的逻辑和组件
function AppContent({ Component, pageProps }) {
  const { data: session, status } = useSession();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // 在现有的useEffect之前添加缓存初始化
  useEffect(() => {
    // 初始化缓存系统
    initializeCache();
  }, []);
  
  const initializeCache = async () => {
    try {
      
      // 启动缓存清理任务
      startCacheCleanup();
      
      // 使用requestIdleCallback替代setTimeout，在浏览器空闲时进行预热
      if (typeof window !== 'undefined') {
        const warmupCacheWhenIdle = () => {
          // 在浏览器空闲时执行预热，不阻塞重要操作
          if (window.requestIdleCallback) {
            window.requestIdleCallback(async () => {
              const startTime = performance.now();
              
              await warmupCommonData();
              
              const endTime = performance.now();
              
              // 在开发环境中显示缓存统计
              if (process.env.NODE_ENV === 'development') {
                const stats = getCacheStats();
              }
            }, { timeout: 500 }); // 设置最大等待时间
          } else {
            // 兼容不支持requestIdleCallback的浏览器
            setTimeout(async () => {
              const startTime = performance.now();
              
              await warmupCommonData();
              
              const endTime = performance.now();
              
              if (process.env.NODE_ENV === 'development') {
                const stats = getCacheStats();
              }
            }, 100); // 使用较短的延迟
          }
        };
        
        // 在第一次渲染后调用
        warmupCacheWhenIdle();
      }
    } catch (error) {
      console.error('[缓存] 缓存初始化失败:', error);
    }
  };

  // 获取未读通知数量
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchUnreadCount = async () => {
        try {
          const res = await fetch('/api/notifications?readStatus=unread&limit=1');
          const data = await res.json();

          if (data.success) {
            setUnreadNotificationsCount(data.totalNotifications);
          }
        } catch (error) {
          console.error('获取未读通知数量失败:', error);
        }
      };

      fetchUnreadCount();

      // 可以添加轮询来定期检查新通知
      const interval = setInterval(fetchUnreadCount, 60000); // 每分钟检查一次

      return () => clearInterval(interval);
    } else {
      // 用户未认证时，将未读通知数量重置为 0
      setUnreadNotificationsCount(0);
    }
  }, [status]); // 依赖 status 变化

  // 为全局对象添加设置未读通知数量的函数
  useEffect(() => {
    window.setUnreadNotificationsCount = (count) => {
      setUnreadNotificationsCount(count);
    };
    
    return () => {
      delete window.setUnreadNotificationsCount;
    };
  }, []);

  // 如果 session 正在加载，可以显示加载状态
  if (status === 'loading') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: 'var(--text-primary)'
      }}>
        加载中...
      </div>
    );
  }

  return (
    <>
      {/* Nav 组件需要访问 session，所以放在这里 */}
      <Nav unreadNotificationsCount={unreadNotificationsCount} />
      <main className="main-content">
        {/* 当前页面组件也需要访问 session 和通知数量 */}
        <Component
          {...pageProps}
          unreadNotificationsCount={unreadNotificationsCount}
          setUnreadNotificationsCount={setUnreadNotificationsCount}
        />
      </main>
    </>
  );
}

export default function MyApp({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: 'var(--text-primary)'
      }}>
        加载中...
      </div>
    );
  }

  // Stagewise 配置对象
  const stagewiseConfig = {
    plugins: []
  };

  return (
    // SessionProvider 应该包裹所有需要访问 session 的组件
    <SessionProvider session={pageProps.session}>
      <ThemeProvider>
        {/* 在开发环境中渲染 Stagewise 工具栏 */}
        {process.env.NODE_ENV === 'development' && StagewiseToolbar && (
          <StagewiseToolbar config={stagewiseConfig} />
        )}
        {/* 在 SessionProvider 内部渲染 AppContent */}
        <AppContent Component={Component} pageProps={pageProps} />
      </ThemeProvider>
    </SessionProvider>
  );
} 