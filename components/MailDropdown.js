import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { 
  MdEmail, MdMarkEmailRead, MdMoreHoriz, 
  MdPersonAdd, MdCode, MdComment, MdArrowForward
} from 'react-icons/md';
import styles from '../styles/MailDropdown.module.css';

export default function MailDropdown({ unreadNotificationsCount = 0 }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);
  const router = useRouter();
  
  // 获取最近的未读通知
  const fetchRecentNotifications = async () => {
    if (!isMenuOpen) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/notifications?readStatus=unread&limit=5');
      const data = await res.json();
      
      if (data.success) {
        setNotifications(data.data || []);
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
  
  // 打开菜单时获取通知
  useEffect(() => {
    if (isMenuOpen) {
      fetchRecentNotifications();
    }
  }, [isMenuOpen]);
  
  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // 切换菜单显示/隐藏
  const toggleMenu = (e) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };
  
  // 将所有通知标记为已读
  const markAllAsRead = async () => {
    if (notifications.length === 0) return;
    
    try {
      const notificationIds = notifications.map(notification => notification._id);
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationIds,
          read: true
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // 更新本地状态
        setNotifications([]);
        // 如果有提供更新未读通知数量的函数，则调用它
        if (window.updateUnreadNotificationsCount) {
          window.updateUnreadNotificationsCount();
        }
      } else {
        throw new Error(data.error || '标记已读失败');
      }
    } catch (err) {
      console.error('标记通知为已读失败:', err);
      setError(err.message);
    }
  };
  
  // 获取通知图标
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'follow':
        return <MdPersonAdd className={styles.notificationTypeIcon} />;
      case 'new_prompt':
        return <MdCode className={styles.notificationTypeIcon} />;
      case 'new_comment':
        return <MdComment className={styles.notificationTypeIcon} />;
      default:
        return <MdEmail className={styles.notificationTypeIcon} />;
    }
  };
  
  // 获取通知预览文本
  const getNotificationText = (notification) => {
    switch (notification.type) {
      case 'follow':
        return `${notification.sender?.name || '用户'} 关注了你`;
      case 'new_prompt':
        return `${notification.sender?.name || '用户'} 发布了新的 Prompt`;
      case 'new_comment':
        return `${notification.sender?.name || '用户'} 发表了新评论`;
      default:
        return '新通知';
    }
  };
  
  // 获取通知链接
  const getNotificationLink = (notification) => {
    switch (notification.type) {
      case 'follow':
        return `/profile/${notification.sender?._id}`;
      case 'new_prompt':
        return `/prompt/${notification.relatedEntity?._id}`;
      case 'new_comment':
        if (notification.relatedEntity?.prompt) {
          return `/prompt/${notification.relatedEntity.prompt}#comment-${notification.relatedEntity._id}`;
        }
        return `/dashboard?tab=comments`;
      default:
        return '/mail';
    }
  };
  
  // 处理通知点击
  const handleNotificationClick = async (notification) => {
    // 关闭下拉菜单
    setIsMenuOpen(false);
    
    // 将此通知标记为已读
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationIds: [notification._id],
          read: true
        }),
      });
      
      // 如果有提供更新未读通知数量的函数，则调用它
      if (window.updateUnreadNotificationsCount) {
        window.updateUnreadNotificationsCount();
      }
    } catch (err) {
      console.error('标记通知为已读失败:', err);
    }
  };
  
  return (
    <div className={styles.mailDropdownContainer} ref={dropdownRef}>
      <button 
        onClick={toggleMenu}
        className={styles.mailButton}
        title="消息通知"
        aria-label="消息通知"
      >
        <div className={styles.iconWrapper}>
          <MdEmail size={24} />
          {unreadNotificationsCount > 0 && (
            <span className={styles.notificationBadge}>
              {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
            </span>
          )}
        </div>
      </button>
      
      {isMenuOpen && (
        <div className={styles.dropdownMenu}>
          <div className={styles.dropdownHeader}>
            <h3 className={styles.dropdownTitle}>通知</h3>
            {notifications.length > 0 && (
              <button 
                className={styles.markAllReadButton}
                onClick={markAllAsRead}
                title="全部标为已读"
              >
                <MdMarkEmailRead size={20} />
              </button>
            )}
          </div>
          
          <div className={styles.notificationsList}>
            {loading ? (
              <div className={styles.loadingState}>加载中...</div>
            ) : error ? (
              <div className={styles.errorState}>加载失败: {error}</div>
            ) : notifications.length > 0 ? (
              <>
                {notifications.map(notification => (
                  <Link
                    key={notification._id}
                    href={getNotificationLink(notification)}
                    className={styles.notificationItem}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={styles.senderAvatar}>
                      {notification.sender?.image ? (
                        <Image 
                          src={notification.sender.image} 
                          alt={notification.sender.name || '用户头像'} 
                          width={36} 
                          height={36}
                          className={styles.avatarImage}
                        />
                      ) : (
                        <div className={styles.defaultAvatar}>
                          {notification.sender?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className={styles.notificationContent}>
                      <p className={styles.notificationText}>
                        {getNotificationText(notification)}
                      </p>
                      <span className={styles.notificationTime}>
                        {new Date(notification.createdAt).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </Link>
                ))}
              </>
            ) : (
              <div className={styles.emptyState}>没有未读通知</div>
            )}
          </div>
          
          <div className={styles.dropdownFooter}>
            <Link href="/mail" className={styles.viewAllButton} onClick={() => setIsMenuOpen(false)}>
              查看全部通知 <MdArrowForward />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
} 