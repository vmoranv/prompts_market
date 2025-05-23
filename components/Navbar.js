import Link from 'next/link';
import styles from '../styles/Navbar.module.css';
import { useSession } from 'next-auth/react';

const Navbar = () => {
  const { data: session } = useSession();

  return (
    <div className={styles.navbar}>
      {!session ? (
        <Link href="/signin" className={styles.loginButton}>
          登录
        </Link>
      ) : (
        // 已登录用户的UI...
      )}
    </div>
  );
};

export default Navbar; 