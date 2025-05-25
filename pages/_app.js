import { useState, useEffect } from 'react';
import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "../contexts/ThemeContext";
import Nav from '../components/Nav';
import '../styles/globals.css';

// 创建一个内部组件来包含需要访问 session 的逻辑和组件
function AppContent({ Component, pageProps }) {
  const { data: session, status } = useSession();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

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

  return (
    // SessionProvider 应该包裹所有需要访问 session 的组件
    <SessionProvider session={pageProps.session}>
      <ThemeProvider>
        {/* 在 SessionProvider 内部渲染 AppContent */}
        <AppContent Component={Component} pageProps={pageProps} />
      </ThemeProvider>
    </SessionProvider>
  );
} 