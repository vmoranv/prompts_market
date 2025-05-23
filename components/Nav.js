import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import { MdAddCircleOutline } from 'react-icons/md'; // 导入 Material Design 的加号图标
import ThemeToggle from './ThemeToggle';
import styles from '../styles/Nav.module.css'; // 假设您有一个导航栏样式文件

export default function Nav() {
  const { data: session, status } = useSession();

  return (
    <nav className={styles.nav}>
      <div className={styles.navContainer}>
        <Link href="/" className={styles.logo}>
          Prompt Market
        </Link>
        
        <div className={styles.navLinks}>
          {/* 主题切换按钮 */}
          <ThemeToggle />
          
          {status === 'loading' ? (
            <span>加载中...</span>
          ) : session ? (
            <>
              {/* 管理员链接 */}
              {session.user.role === 'admin' && (
                <Link href="/admin/review-prompts" className={styles.navLink}>
                  审核 Prompts
                </Link>
              )}
              
              {/* 创建新 Prompt 按钮 - 使用图标替代文本 */}
              <Link href="/create-prompt" className={styles.iconLink} title="创建新 Prompt">
                <MdAddCircleOutline size={24} />
              </Link>
              
              {/* 用户信息和登出按钮 */}
              <div className={styles.userInfo}>
                {session.user.image && (
                  <img 
                    src={session.user.image} 
                    alt={session.user.name || '用户头像'} 
                    className={styles.userAvatar}
                  />
                )}
                <span>{session.user.name || session.user.email}</span>
              </div>
              
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
      </div>
    </nav>
  );
} 