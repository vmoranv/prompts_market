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
  // 将 userId 转换为字符串进行比较，以防类型不匹配
  return likedBy.map(id => id.toString()).includes(userId.toString());
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

export default function PromptCard({ prompt }) {
  if (!prompt) return null; // 添加一个保护，防止 prompt 未定义

  const [copied, setCopied] = useState(false); // 状态追踪复制操作
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { data: session, status } = useSession(); // 在组件内部获取 session
  const userId = session?.user?.id; // 获取当前登录用户的 ID
  
  // 在客户端渲染后设置 isClient 为 true
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // 使用组件内部获取的 userId 判断是否为作者
  const isAuthor = userId && prompt.author?._id === userId;
  // 使用组件内部获取的 session 判断是否为管理员
  const isCurrentUserAdmin = session?.user?.role === 'admin';

  // 使用状态来管理点赞数和当前用户是否已点赞
  const [likesCount, setLikesCount] = useState(prompt.likesCount || 0);
  // 使用组件内部获取的 userId 检查是否已点赞
  const [isLiked, setIsLiked] = useState(checkIsLiked(prompt.likedBy, userId));
  const [isLoading, setIsLoading] = useState(false); // 用于防止重复点击

  // 当 prompt 或 session 变化时，更新 isLiked 状态
  useEffect(() => {
    // 使用组件内部获取的 userId 更新 isLiked 状态
    setIsLiked(checkIsLiked(prompt.likedBy, userId));
    setLikesCount(prompt.likesCount || 0); // 确保在 prompt 数据更新时同步点赞数
  }, [prompt, userId]); // 依赖项包括 userId
  
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

  // 重新定义 canManagePrompts，使用组件内部的 isAuthor 和 isCurrentUserAdmin
  const canManagePrompts = isAuthor || isCurrentUserAdmin;

  // 处理删除 Prompt
  const handleDeletePrompt = async () => {
    // 权限检查：只有作者或管理员才能删除
    if (!canManagePrompts) {
        alert('您没有权限删除此 Prompt。');
        return;
    }

    if (confirmDelete) {
      try {
        const res = await fetch(`/api/prompts/${prompt._id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `删除失败: ${res.status}`);
        }
        setConfirmDelete(false);
        console.log(`Prompt ${prompt._id} 已成功删除。`);
      } catch (err) {
        console.error("删除 Prompt 失败:", err);
        alert(`删除 Prompt 失败: ${err.message}`);
        setConfirmDelete(false); // 删除失败也重置确认状态
      }
    } else {
      setConfirmDelete(true); // 第一次点击显示确认
    }
  };

  // 处理点赞/取消点赞
  const handleLike = async () => {
    // 只有登录用户才能点赞
    if (status !== 'authenticated') {
      alert('请登录后点赞。');
      return;
    }
    if (isLoading) return; // 防止重复点击

    setIsLoading(true);
    const method = isLiked ? 'DELETE' : 'POST'; // 如果已点赞，则取消点赞 (DELETE); 否则点赞 (POST)
    const endpoint = `/api/prompts/${prompt._id}/like`;

    try {
      const res = await fetch(endpoint, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `点赞操作失败: ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        // 更新本地状态
        setIsLiked(!isLiked);
        setLikesCount(data.likesCount); // 使用后端返回的最新点赞数
        console.log(`Prompt ${prompt._id} 点赞状态更新成功。`);
      } else {
         throw new Error(data.error || '点赞操作失败');
      }

    } catch (err) {
      console.error("点赞操作失败:", err);
      alert(`点赞操作失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

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
          {isClient ? <SafeMarkdown content={truncatedContent} /> : <p>{truncatedContent}</p>}
        </div>
        
        <div className={styles.cardFooter}>
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <button
                onClick={handleLike}
                disabled={status === 'loading' || isLoading}
                className={`${styles.likeButton} ${isLiked ? styles.liked : ''}`}
                aria-label={isLiked ? '取消点赞' : '点赞'}
              >
                {isLiked ? (
                  <MdFavorite className={styles.likedIcon} />
                ) : (
                  <MdFavoriteBorder className={styles.likeIcon} />
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
      
      {canManagePrompts && (
        <div className={styles.actions}>
          <Link href={`/edit-prompt/${prompt._id}`} className={styles.editButton}>
            <MdEdit size={18} />
            <span>编辑</span>
          </Link>
          
          <button 
            onClick={handleDeletePrompt} 
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