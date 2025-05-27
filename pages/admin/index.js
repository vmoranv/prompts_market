import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import styles from '../../styles/AdminIndex.module.css'; // 需要创建这个 CSS 文件
import { MdArrowBack } from 'react-icons/md'; // 添加 MdArrowBack 导入

export default function AdminIndexPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 检查用户是否已登录且为管理员
  useEffect(() => {
    if (status === 'loading') return; // 等待 session 加载
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',') : [];
    const isAdmin = session?.user?.email ? adminEmails.includes(session.user.email) : false;

    if (!session || !isAdmin) {
      // 如果不是管理员，重定向到首页或登录页
      router.push('/'); // 或者您希望的未授权页面
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return <div className={styles.loading}>加载中...</div>; // 加载状态显示
  }

  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',') : [];
  const isAdmin = session?.user?.email ? adminEmails.includes(session.user.email) : false;

  const [isCleaningNotifications, setIsCleaningNotifications] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  const handleCleanupNotifications = async () => {
    if (!confirm('确定要清理孤立的通知吗？此操作不可撤销。')) return;
    
    setIsCleaningNotifications(true);
    setCleanupResult(null);
    
    try {
      const res = await fetch('/api/admin/cleanup-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await res.json();
      
      if (data.success) {
        setCleanupResult({
          type: 'success',
          message: `清理完成！共清理了 ${data.result.totalCleaned} 条孤立通知`,
          details: data.result
        });
      } else {
        throw new Error(data.error || '清理失败');
      }
    } catch (error) {
      setCleanupResult({
        type: 'error',
        message: `清理失败: ${error.message}`
      });
    } finally {
      setIsCleaningNotifications(false);
    }
  };

  if (!session || !isAdmin) {
    return null; // 如果不是管理员，useEffect 会处理重定向，这里不渲染内容
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>管理员面板 - Promptopia</title>
        <meta name="description" content="Promptopia 管理员面板" />
      </Head>

      <div className={styles.header}> {/* 可以复用 header 样式或创建新的 */}
        <Link href="/" className={styles.backButton}>
          <MdArrowBack />
          <span>返回主页</span>
        </Link>
        <h1 className={styles.title}>管理员面板</h1>
        <div className={styles.headerPlaceholder}></div>
      </div>

      <div className={styles.linkContainer}>
        <Link href="/admin/review-prompts" className={styles.adminLink}>
          审核提示
        </Link>
        <Link href="/admin/comments" className={styles.adminLink}>
          审核评论
        </Link>
        <button
          onClick={handleCleanupNotifications}
          disabled={isCleaningNotifications}
          className={styles.adminLink}
        >
          {isCleaningNotifications ? '清理中...' : '清理孤立通知'}
        </button>
      </div>

      {/* 清理结果显示区域移到外面 */}
      {cleanupResult && (
        <div className={`${styles.cleanupResult} ${styles[cleanupResult.type]}`}>
          <p>{cleanupResult.message}</p>
          {cleanupResult.details && (
            <ul>
              <li>Prompt 通知: {cleanupResult.details.promptNotifications}</li>
              <li>Comment 通知: {cleanupResult.details.commentNotifications}</li>
            </ul>
          )}
        </div>
      )}
      <div className={styles.footer}>
        <p>© {new Date().getFullYear()} Prompt_Market. 保留所有权利。</p>
      </div>
    </div>
  );
} 