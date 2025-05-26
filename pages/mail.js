import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { 
  MdEmail, MdMarkEmailRead, MdMarkEmailUnread, MdRefresh, 
  MdPersonAdd, MdCode, MdComment, MdSentimentDissatisfied, 
  MdArrowForward, MdArrowBack
} from 'react-icons/md';
import styles from '../styles/Mail.module.css';

export default function MailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'read', 'unread'
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalNotifications, setTotalNotifications] = useState(0);

  // 重定向未登录用户
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/mail');
    }
  }, [status, router]);

  // 获取通知列表
  const fetchNotifications = async (page = 1, readStatus = 'all') => {
    if (status !== 'authenticated') return;
    
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/notifications?page=${page}&limit=10&readStatus=${readStatus}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `获取通知失败：${res.status}`);
      }

      if (data.success) {
        setNotifications(data.data);
        setCurrentPage(data.currentPage);
        setTotalPages(data.totalPages);
        setTotalNotifications(data.totalNotifications);
      } else {
        throw new Error(data.error || '获取通知失败');
      }
    } catch (err) {
      console.error('获取通知失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 当会话状态或活动标签改变时获取通知
  useEffect(() => {
    if (status === 'authenticated') {
      fetchNotifications(1, activeTab);
    }
  }, [status, activeTab]);

  // 标记通知为已读
  const markAsRead = async (notificationId) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationIds: [notificationId],
          read: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `标记通知失败：${res.status}`);
      }

      // 更新本地通知状态
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => 
          notification._id === notificationId 
            ? { ...notification, read: true } 
            : notification
        )
      );
      
    } catch (err) {
      console.error('标记通知已读失败:', err);
      // 可以选择是否显示错误消息给用户
    }
  };

  // 处理通知点击
  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification._id);
    }
    
    // 根据通知类型导航到相应的页面
    const link = getNotificationLink(notification);
    if (link) {
      router.push(link);
    }
  };

  // 生成通知文本的函数
  const getNotificationText = (notification) => {
    const senderName = notification.sender?.name || '有人';
    
    switch (notification.type) {
      case 'follow':
        return `${senderName} 关注了你`;
        
      case 'new_prompt':
        return `${senderName} 发布了新的 Prompt: ${notification.relatedEntity?.title || ''}`;
        
      case 'new_comment':
        return `${senderName} 评论了: ${notification.relatedEntity?.content.substring(0, 30)}${notification.relatedEntity?.content.length > 30 ? '...' : ''}`;
        
      case 'prompt_approved':
        return `你的 Prompt "${notification.relatedEntity?.title || ''}" 已通过审核`;
        
      case 'prompt_rejected':
        return `你的 Prompt "${notification.relatedEntity?.title || ''}" 未通过审核`;
        
      default:
        return '收到一条新通知';
    }
  };
  
  // 获取通知图标的函数
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'follow':
        return <MdPersonAdd className={styles.notificationTypeIcon} />;
        
      case 'new_prompt':
        return <MdCode className={styles.notificationTypeIcon} />;
        
      case 'new_comment':
        return <MdComment className={styles.notificationTypeIcon} />;
        
      case 'prompt_approved':
      case 'prompt_rejected':
        return <MdCode className={styles.notificationTypeIcon} />;
        
      default:
        return <MdEmail className={styles.notificationTypeIcon} />;
    }
  };

  // 获取通知链接的函数
  const getNotificationLink = (notification) => {
    if (notification.type === 'follow') {
      return `/users/${notification.sender?._id}`;
    } else if (notification.type === 'prompt_rejected') {
      // 拒绝通知不提供链接跳转
      return '/dashboard';
    } else if (notification.link) {
      return notification.link;
    }
    return '/';
  };

  // 处理标签切换
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1); // 切换标签时重置页码
  };

  // 刷新通知列表
  const refreshNotifications = () => {
    fetchNotifications(currentPage, activeTab);
  };

  // 处理分页
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchNotifications(newPage, activeTab);
    }
  };

  // 根据通知类型获取图标和文本
  const getNotificationMetadata = (notification) => {
    switch (notification.type) {
      case 'follow':
        return {
          icon: <MdPersonAdd className={styles.notificationTypeIcon} />,
          text: '关注了您',
          color: 'var(--md-primary)',
        };
      case 'new_prompt':
        return {
          icon: <MdCode className={styles.notificationTypeIcon} />,
          text: '发布了新提示',
          color: 'var(--md-tertiary)',
        };
      case 'new_comment':
        return {
          icon: <MdComment className={styles.notificationTypeIcon} />,
          text: '发表了新评论',
          color: 'var(--md-secondary)',
        };
      default:
        return {
          icon: <MdEmail className={styles.notificationTypeIcon} />,
          text: '新通知',
          color: 'var(--md-on-surface-variant)',
        };
    }
  };

  // 处理标记所有已读
  const handleMarkAllRead = async () => {
    const unreadNotificationIds = notifications
      .filter(notification => !notification.read)
      .map(notification => notification._id);

    if (unreadNotificationIds.length === 0) return;

    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationIds: unreadNotificationIds,
          read: true
        }),
      });

      const data = await res.json();

      if (data.success) {
        // 更新本地状态，将所有当前显示的未读通知标记为已读
        setNotifications(prevNotifications =>
          prevNotifications.map(notification => ({ ...notification, read: true }))
        );
        // 如果有提供更新未读通知数量的函数，则调用它
        if (window.updateUnreadNotificationsCount) {
          window.updateUnreadNotificationsCount();
        }
      } else {
        throw new Error(data.error || '标记所有已读失败');
      }
    } catch (err) {
      console.error('标记所有通知为已读失败:', err);
      // 可以选择是否显示错误消息给用户
    }
  };

  if (status === 'loading') {
    return (
      <div className={styles.statusMessage}>
        <MdRefresh className="animate-spin" size={40} />
        加载通知中...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    // 重定向已经在 useEffect 中处理，这里可以显示一个简单的消息或 null
    return null;
  }

  return (
    <>
      <Head>
        <title>站内消息 | AI Prompt 社区</title>
        <meta name="description" content="查看您的站内消息和通知" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.container}>
        <div className={styles.main}>
          <h1 className={styles.title}>
            <MdEmail className={styles.titleIcon} />
            站内消息
          </h1>

          {/* 工具栏：标签切换和刷新按钮 */}
          <div className={styles.toolbar}>
            <div className={styles.tabs}>
              <button 
                className={`${styles.tab} ${activeTab === 'all' ? styles.activeTab : ''}`} 
                onClick={() => handleTabChange('all')}
              >
                <MdEmail /> 全部 {totalNotifications > 0 && <span>({totalNotifications})</span>}
              </button>
              <button 
                className={`${styles.tab} ${activeTab === 'unread' ? styles.activeTab : ''}`} 
                onClick={() => handleTabChange('unread')}
              >
                <MdMarkEmailUnread /> 未读
              </button>
              <button 
                className={`${styles.tab} ${activeTab === 'read' ? styles.activeTab : ''}`} 
                onClick={() => handleTabChange('read')}
              >
                <MdMarkEmailRead /> 已读
              </button>
            </div>
            <button 
              className={styles.refreshButton}
              onClick={refreshNotifications}
              disabled={loading}
            >
              <MdRefresh className={loading ? styles.spinning : ''} /> 刷新
            </button>
          </div>

          {/* 通知列表 */}
          <div className={styles.notificationsContainer}>
            {loading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>加载通知中...</p>
              </div>
            ) : error ? (
              <div className={styles.errorContainer}>
                <MdSentimentDissatisfied size={48} />
                <p>获取通知失败: {error}</p>
                <button 
                  className={styles.retryButton}
                  onClick={refreshNotifications}
                >
                  重试
                </button>
              </div>
            ) : notifications.length > 0 ? (
              <>
                <ul className={styles.notificationsList}>
                  {notifications.map(notification => {
                    const { icon, text, color } = getNotificationMetadata(notification);
                    const link = getNotificationLink(notification);
                    return (
                      <li 
                        key={notification._id} 
                        className={`${styles.notificationItem} ${notification.read ? styles.readNotification : styles.unreadNotification}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {/* 左侧：发送者头像 */}
                        <div className={styles.senderAvatar}>
                          {notification.sender?.image ? (
                            <Image 
                              src={notification.sender.image}
                              alt={notification.sender.name}
                              width={40}
                              height={40}
                              className={styles.avatar}
                            />
                          ) : (
                            <div className={styles.defaultAvatar}>
                              {notification.sender?.name?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                        
                        {/* 中间：通知内容 */}
                        <div className={styles.notificationContent}>
                          {/* 通知头部：发送者名称 + 动作 */}
                          <div className={styles.notificationHeader}>
                            <span className={styles.senderName}>{notification.sender?.name}</span>
                            <span className={styles.notificationType} style={{ color }}>
                              {icon} {text}
                            </span>
                          </div>
                          
                          {/* 通知详情：根据类型显示不同内容 */}
                          {notification.type === 'follow' ? (
                            <p className={styles.notificationDetail}>
                              {notification.sender?.name} 开始关注了您，
                              <Link href={link} className={styles.notificationDetailLink}>
                                <span>点击查看他的主页</span>
                              </Link>
                            </p>
                          ) : notification.type === 'new_prompt' && notification.relatedEntity ? (
                            <p className={styles.notificationDetail}>
                              发布了新提示：<strong>{notification.relatedEntity.title}</strong>
                              <Link href={link} className={styles.notificationDetailLink}>
                                <span>点击查看提示详情</span>
                              </Link>
                            </p>
                          ) : notification.type === 'new_comment' && notification.relatedEntity ? (
                            <p className={styles.notificationDetail}>
                              在提示 <strong>{notification.relatedEntity?.title || '未知提示'}</strong> 下发表评论：
                              <span className={styles.commentPreview}>{notification.relatedEntity?.content.substring(0, 30)}${notification.relatedEntity?.content.length > 30 ? '...' : ''}</span>
                              <Link href={link} className={styles.notificationDetailLink}>
                                <span>点击查看评论</span>
                              </Link>
                            </p>
                          ) : notification.type === 'prompt_approved' && notification.relatedEntity ? (
                            <p className={styles.notificationDetail}>
                              您的 Prompt <strong>"{notification.relatedEntity.title || '未知提示'}"</strong> 已通过审核。
                              {link && (
                                <Link href={link} className={styles.notificationDetailLink}>
                                  <span>点击查看</span>
                                </Link>
                              )}
                            </p>
                          ) : notification.type === 'prompt_rejected' && notification.relatedEntity ? (
                            <p className={styles.notificationDetail}>
                              您的 Prompt <strong>"{notification.relatedEntity.title || '未知提示'}"</strong> 未通过审核。
                              {link && (
                                <Link href={link} className={styles.notificationDetailLink}>
                                  <span>点击查看详情</span>
                                </Link>
                              )}
                            </p>
                          ) : (
                            <p className={styles.notificationDetail}>
                              您收到了一条新通知
                              {link && link !== '/mail' && (
                                <Link href={link} className={styles.notificationDetailLink}>
                                  <span>点击查看</span>
                                </Link>
                              )}
                            </p>
                          )}
                          
                          {/* 通知时间 */}
                          <div className={styles.notificationTime}>
                            {new Date(notification.createdAt).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        
                        {/* 右侧：箭头图标 */}
                        <div className={styles.notificationAction}>
                          <MdArrowForward />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                
                {/* 分页控件 */}
                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button 
                      className={styles.pageButton}
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <MdArrowBack /> 上一页
                    </button>
                    <span className={styles.pageInfo}>
                      {currentPage} / {totalPages}
                    </span>
                    <button 
                      className={styles.pageButton}
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      下一页 <MdArrowForward />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>
                <MdSentimentDissatisfied size={48} />
                <p>您目前没有任何{activeTab === 'unread' ? '未读' : (activeTab === 'read' ? '已读' : '')}通知</p>
                {activeTab !== 'all' && (
                  <button 
                    className={styles.viewAllButton}
                    onClick={() => handleTabChange('all')}
                  >
                    查看所有通知
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// 为了确保每次请求页面时都能获取最新的通知数据
export const dynamic = 'force-dynamic'; 