import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import { MdAddCircleOutline, MdMenu, MdClose, MdEmail, MdBrightness4, MdChat } from 'react-icons/md';
import ThemeToggle from './ThemeToggle';
import MailDropdown from './MailDropdown';
import { useTheme } from '../contexts/ThemeContext';
import styles from '../styles/Nav.module.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function Nav({ unreadNotificationsCount = 0 }) {
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  // 切换移动端菜单
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // 关闭移动端菜单
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };
  useEffect(() => {
    window.updateUnreadNotificationsCount = async () => {
      try {
        const res = await fetch('/api/notifications?readStatus=unread&limit=1');
        const data = await res.json();
        
        if (data.success) {
          if (window.setUnreadNotificationsCount) {
            window.setUnreadNotificationsCount(data.totalNotifications);
          }
        }
      } catch (error) {
        console.error('更新未读通知数量失败:', error);
      }
    };
    
    return () => {
      delete window.updateUnreadNotificationsCount;
    };
  }, []);
  // 处理移动端菜单的body滚动锁定
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      
      // 添加移动端菜单标识，用于CSS样式控制
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('mobile-menu-open');
    }
    
    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('mobile-menu-open');
    };
  }, [isMobileMenuOpen]);
  return (
    <nav className={styles.nav}>
      <div className={styles.navContainer}>
        <Link href="/" className={styles.logo}>
          Prompt Market
        </Link>
        
        {/* 桌面端导航链接 */}
        <div className={styles.navLinks}>
          {/* 主题切换按钮 */}
          <ThemeToggle />
          
          {status === 'loading' ? (
            <span>加载中...</span>
          ) : session ? (
            <>
              {/* 管理员链接 */}
              {session.user.role === 'admin' && (
                <Link href="/admin" className={styles.navLink}>
                  审核页
                </Link>
              )}
              
              {/* 邮件通知下拉组件 */}
              <MailDropdown unreadNotificationsCount={unreadNotificationsCount} />
              
              {/* 创建新 Prompt 按钮 */}
              <Link href="/create-prompt" className={styles.iconLink} title="创建新 Prompt">
                <MdAddCircleOutline size={24} />
              </Link>
              
              {/* 多Prompt聊天按钮 */}
              <Link href="/try-prompt" className={styles.iconLink} title="多Prompt聊天">
                <MdChat size={24} />
              </Link>
              
              {/* 用户信息和登出按钮 */}
              <Link href="/dashboard" className={styles.userInfo}>
                {session.user.image && (
                  <img 
                    src={session.user.image} 
                    alt={session.user.name || '用户头像'} 
                    className={styles.userAvatar}
                  />
                )}
                <span>{session.user.name || session.user.email}</span>
              </Link>
              
              <button onClick={() => signOut()} className={styles.signButton}>
                退出
              </button>
            </>
          ) : (
            <Link href="/signin" className={styles.signButton}>
              登录
            </Link>
          )}
        </div>

        {/* 移动端汉堡菜单按钮 */}
        <button 
          className={styles.mobileMenuButton}
          onClick={toggleMobileMenu}
          aria-label="打开菜单"
        >
          <MdMenu size={24} />
        </button>
      </div>

      {/* 移动端全屏侧边栏 */}
      <div className={`${styles.mobileMenu} ${isMobileMenuOpen ? styles.mobileMenuOpen : ''}`}>
        <div className={styles.mobileMenuOverlay} onClick={closeMobileMenu}></div>
        <div className={styles.mobileMenuContent}>
          {/* 侧边栏头部 */}
          <div className={styles.mobileMenuHeader}>
            <Link href="/" className={styles.mobileMenuLogo} onClick={closeMobileMenu}>
              Prompt Market
            </Link>
            <button 
              className={styles.mobileMenuCloseButton}
              onClick={closeMobileMenu}
              aria-label="关闭菜单"
            >
              <MdClose size={24} />
            </button>
          </div>

          {/* 侧边栏导航项 */}
          <div className={styles.mobileMenuItems}>
            {status === 'loading' ? (
              <div className={styles.mobileMenuItem}>加载中...</div>
            ) : session ? (
              <>
                {/* 用户信息 */}
                <Link href="/dashboard" className={styles.mobileUserInfo} onClick={closeMobileMenu}>
                  {session.user.image && (
                    <img 
                      src={session.user.image} 
                      alt={session.user.name || '用户头像'} 
                      className={styles.mobileUserAvatar}
                    />
                  )}
                  <div className={styles.mobileUserDetails}>
                    <span className={styles.mobileUserName}>{session.user.name || session.user.email}</span>
                    <span className={styles.mobileUserRole}>用户中心</span>
                  </div>
                </Link>

                {/* 分割线 */}
                <div className={styles.mobileMenuDivider}></div>

                {/* 创建新 Prompt */}
                <Link href="/create-prompt" className={styles.mobileMenuItem} onClick={closeMobileMenu}>
                  <MdAddCircleOutline size={20} />
                  <span>创建 Prompt</span>
                </Link>                {/* 邮件通知 */}
                <div 
                  className={`${styles.mobileMenuItem} ${styles.mobileMenuItemSpecial}`}
                  onClick={() => {
                    // 在移动端直接跳转到通知页面
                    router.push('/mail');
                    closeMobileMenu();
                  }}
                >
                  <MdEmail size={20} className={styles.mobileMenuIcon} />
                  <span>消息通知</span>
                  {unreadNotificationsCount > 0 && (
                    <span className={styles.mobileNotificationBadge}>
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
                  )}
                </div>{/* 管理员链接 */}
                {session.user.role === 'admin' && (
                  <Link href="/admin" className={styles.mobileMenuItem} onClick={closeMobileMenu}>
                    <span>审核页</span>
                  </Link>                )}

                {/* 主题切换 */}
                <div 
                  className={`${styles.mobileMenuItem} ${styles.mobileMenuItemSpecial}`}
                  onClick={(e) => {
                    // 阻止事件冒泡
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 在移动端直接切换主题
                    toggleTheme();
                  }}
                >
                  <MdBrightness4 size={20} className={styles.mobileMenuIcon} />
                  <span>主题设置</span>
                  <span className={styles.mobileThemeIndicator}>
                    {theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}
                  </span>
                </div>

                {/* 分割线 */}
                <div className={styles.mobileMenuDivider}></div>

                {/* 退出按钮 */}
                <button 
                  onClick={() => {
                    signOut();
                    closeMobileMenu();
                  }} 
                  className={styles.mobileSignOutButton}
                >
                  退出登录
                </button>
              </>              ) : (              <>                {/* 主题切换 */}
                <div 
                  className={`${styles.mobileMenuItem} ${styles.mobileMenuItemSpecial}`}
                  onClick={(e) => {
                    // 阻止事件冒泡
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 在移动端直接切换主题
                    toggleTheme();
                  }}
                >
                  <MdBrightness4 size={20} className={styles.mobileMenuIcon} />
                  <span>主题设置</span>
                  <span className={styles.mobileThemeIndicator}>
                    {theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}
                  </span>
                </div>

                {/* 分割线 */}
                <div className={styles.mobileMenuDivider}></div>

                {/* 登录按钮 */}
                <Link href="/signin" className={styles.mobileSignInButton} onClick={closeMobileMenu}>
                  登录
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 