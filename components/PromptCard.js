import Link from 'next/link';
import Image from 'next/image';
import styles from '../styles/PromptCard.module.css';
import { useState, useEffect } from 'react';
import { MdContentCopy, MdCheck, MdEdit, MdDelete, MdThumbUp, MdVisibility, MdFavorite, MdFavoriteBorder } from 'react-icons/md';
import SafeMarkdown from './SafeMarkdown';
import { useSession } from 'next-auth/react';

// 辅助函数，用于检查当前用户是否已点赞
const checkIsLiked = (likedBy, userId) => {
  if (!likedBy || !userId) return false;
  // 确保比较的是字符串或 ObjectId，取决于后端返回的 likedBy 数组中存储的类型
  return likedBy.includes(userId);
};

// 辅助函数，用于根据行数和字符数截断文本
const truncateText = (text, maxLines, maxChars) => {
  if (!text) return '';

  const lines = text.split('\n');
  let truncatedLines = lines.slice(0, maxLines);
  let truncatedText = truncatedLines.join('\n');

  let needsEllipsis = false;

  // 如果原始行数超过最大行数，需要添加省略号
  if (lines.length > maxLines) {
    needsEllipsis = true;
  }

  // 如果截断后的文本长度超过最大字符数，则按字符数截断
  if (truncatedText.length > maxChars) {
    truncatedText = truncatedText.substring(0, maxChars);
    needsEllipsis = true; // 即使行数没超，字符数超了也需要省略号
  } else if (lines.length <= maxLines && truncatedText.length <= maxChars) {
      // 如果行数和字符数都没超，则不需要省略号
      needsEllipsis = false;
  }


  return truncatedText + (needsEllipsis ? '...' : '');
};

export default function PromptCard({ prompt, currentUserId, isAdmin }) {
  if (!prompt) return null; // 添加一个保护，防止 prompt 未定义

  const [copied, setCopied] = useState(false); // 状态追踪复制操作
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { data: session } = useSession();
  const userId = session?.user?.id; // 获取当前登录用户的 ID
  
  // 在客户端渲染后设置 isClient 为 true
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const isAuthor = currentUserId && prompt.author?._id === currentUserId;

  // 使用状态来管理点赞数和当前用户是否已点赞
  const [likesCount, setLikesCount] = useState(prompt.likesCount || 0);
  const [isLiked, setIsLiked] = useState(checkIsLiked(prompt.likedBy, userId));
  const [isLoading, setIsLoading] = useState(false); // 用于防止重复点击

  // 当 prompt 或 session 变化时，更新 isLiked 状态
  useEffect(() => {
    setIsLiked(checkIsLiked(prompt.likedBy, userId));
    setLikesCount(prompt.likesCount || 0); // 确保在 prompt 数据更新时同步点赞数
  }, [prompt, userId]);
  
  // 截断 Prompt 内容到前 5 行或 200 个字符
  const truncatedContent = truncateText(prompt.content, 5, 200);

  const handleCopy = () => {
    // 复制完整内容，而不是截断后的内容
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '未知时间';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '无效日期';
    
    const now = new Date();
    const diff = now - date; // 毫秒差
    
    // 转换为秒、分钟、小时、天
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    // 根据时间差显示不同格式
    if (seconds < 60) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      // 超过7天，显示具体日期
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  const formattedDate = prompt.createdAt ? formatDate(prompt.createdAt) : '未知时间';

  const handleDelete = async () => {
    if (confirmDelete) {
      try {
        const response = await fetch(`/api/prompts/${prompt._id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          // 可以使用一个回调通知父组件进行刷新
          window.location.reload(); // 临时解决方案，实际应使用状态管理
        } else {
          console.error('删除失败');
        }
      } catch (error) {
        console.error('删除出错:', error);
      }
    } else {
      setConfirmDelete(true);
      // 5秒后重置确认状态
      setTimeout(() => setConfirmDelete(false), 5000);
    }
  };

  const handleLike = async () => {
    // 如果用户未登录，提示登录
    if (!session) {
      alert('请先登录才能点赞！'); // 或者使用更友好的方式提示
      return;
    }

    // 防止重复点击
    if (isLoading) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/prompts/${prompt._id}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        // 根据 API 返回的数据更新状态
        setLikesCount(data.data.likesCount);
        setIsLiked(data.data.likedByCurrentUser);
        console.log(data.message);
      } else {
        console.error('点赞/取消点赞失败:', data.message);
        alert(`操作失败: ${data.message}`); // 显示错误信息
      }
    } catch (error) {
      console.error('调用点赞 API 发生错误:', error);
      alert('操作过程中发生错误，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
  const isUserAdmin = adminEmails.includes(session?.user?.email);

  const canEditOrDelete = isAdmin || isUserAdmin ||
                         (session?.user?.email === prompt.author?.email);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.authorInfo}>
          {prompt.author ? (
            <Link href={`/dashboard?userId=${prompt.author._id}`} className={styles.authorLink}>
              <Image
                src={prompt.author.image || '/default-avatar.png'}
                alt={prompt.author.name || '作者头像'}
                width={44}
                height={44}
                className={styles.authorImage}
                onError={(e) => { e.target.onerror = null; e.target.src='/default-avatar.png'; }}
              />
              <div className={styles.authorText}>
                <span className={styles.authorName}>{prompt.author.name || '匿名作者'}</span>
                <span className={styles.promptDate}>{formattedDate}</span>
              </div>
            </Link>
          ) : (
            <div className={styles.authorInfo}>
              <Image
                src={'/default-avatar.png'}
                alt={'匿名作者头像'}
                width={44}
                height={44}
                className={styles.authorImage}
              />
              <div className={styles.authorText}>
                <span className={styles.authorName}>匿名作者</span>
                <span className={styles.promptDate}>{formattedDate}</span>
              </div>
            </div>
          )}
        </div>
        {isClient && (
          <button
            onClick={handleCopy}
            className={styles.copyButton}
            title="复制内容"
          >
            {copied ? <MdCheck size={18} /> : <MdContentCopy size={18} />}
            <span className={styles.copyButtonText}>{copied ? '已复制' : '复制'}</span>
          </button>
        )}
      </div>
      
      <div className={styles.cardContent}>
        <Link href={`/prompt/${prompt._id}`} className={styles.promptLink}>
          <h2 className={styles.promptTitle}>{prompt.title}</h2>
        </Link>
        
        <div className={styles.promptContent}>
          <SafeMarkdown content={truncatedContent} />
        </div>
        
        {/* 标签和价格 */}
        <div className={styles.tagsAndPrice}>
          {prompt.tags && prompt.tags.length > 0 && (
            <div className={styles.tags}>
              {prompt.tags.map((tag, index) => (
                <span key={index} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}
          
          {prompt.price > 0 && (
            <div className={styles.price}>¥{prompt.price}</div>
          )}
        </div>
        
        <div className={styles.cardFooter}>
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <button
                onClick={handleLike}
                disabled={isLoading} // 点赞过程中禁用按钮
                className={styles.likeButton}
                aria-label={isLiked ? '取消点赞' : '点赞'} // 辅助功能标签
              >
                {isLiked ? (
                  <MdFavorite className={styles.likedIcon} /> // 已点赞的心形图标
                ) : (
                  <MdFavoriteBorder className={styles.likeIcon} /> // 未点赞的心形图标
                )}
                <span className={styles.likesCount}>{likesCount}</span>
              </button>
            </div>
            <div className={styles.divider}></div>
            <div className={styles.statItem}>
              <MdVisibility className={styles.statIcon} />
              <span className={styles.statValue}>{prompt.viewCount || 0}</span>
            </div>
          </div>
          
          <Link href={`/prompt/${prompt._id}`} className={styles.detailsLink}>
            查看详情
          </Link>
        </div>
      </div>
      
      {canEditOrDelete && (
        <div className={styles.actions}>
          <Link href={`/edit-prompt/${prompt._id}`} className={styles.editButton}>
            <MdEdit size={18} />
            <span>编辑</span>
          </Link>
          
          <button 
            onClick={handleDelete} 
            className={`${styles.deleteButton} ${confirmDelete ? styles.confirm : ''}`}
          >
            <MdDelete size={18} />
            <span>{confirmDelete ? '确认删除?' : '删除'}</span>
          </button>
        </div>
      )}
    </div>
  );
} 