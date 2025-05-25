import Link from 'next/link';
import styles from '../styles/Navbar.module.css';
import { useSession } from 'next-auth/react';
import { MdAccountCircle, MdLogout, MdSettings, MdDashboard, MdEmail } from 'react-icons/md';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

const Navbar = ({ unreadNotificationsCount }) => {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  if (status === "loading") {
    return (
      <div className={styles.navbar}>
        <Link href="/" className={styles.logo}>
          Prompt 市场
        </Link>
        <div className={styles.navLinksLoading}>
          <div className={styles.loadingPlaceholder}></div>
        </div>
      </div>
    );
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        <Link href="/" className={styles.logo}>
          Prompt 市场
        </Link>

        <div className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>
            首页
          </Link>
          {session && (
            <Link href="/create-prompt" className={styles.navLink}>
              创建 Prompt
            </Link>
          )}
          <Link href="/mail" className={styles.navLink}>
            <div className={styles.navIconContainer}>
              <MdEmail />
              {unreadNotificationsCount > 0 && (
                <span className={styles.notificationBadge}>
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </div>
            <span>站内信</span>
          </Link>
        </div>

        <div className={styles.navActions}>
          {!session ? (
            <Link href="/signin" className={`${styles.navLink} ${styles.signInButton}`}>
              登录
            </Link>
          ) : (
            <div className={styles.userMenuContainer} ref={dropdownRef}>
              <button onClick={toggleDropdown} className={styles.userAvatarButton} title="用户菜单">
                {session.user.image ? (
                  <img src={session.user.image} alt="用户头像" className={styles.userAvatar} />
                ) : (
                  <MdAccountCircle className={styles.userAvatarIcon} />
                )}
              </button>
              {isDropdownOpen && (
                <div className={styles.dropdownMenu}>
                  <div className={styles.dropdownHeader}>
                    <span className={styles.dropdownUserName}>{session.user.name || session.user.email}</span>
                  </div>
                  <Link href="/dashboard" className={styles.dropdownItem} onClick={() => setIsDropdownOpen(false)}>
                    <MdDashboard className={styles.dropdownIcon} />
                    用户中心
                  </Link>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      router.push('/api/auth/signout');
                    }}
                    className={`${styles.dropdownItem} ${styles.dropdownItemButton}`}
                  >
                    <MdLogout className={styles.dropdownIcon} />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 